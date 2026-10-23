"""Turn the shop's category workbook into website data.

Usage:
    python3 build_catalog.py <screwfix_style_categories.xlsx> <out_dir>

Writes:
    <out_dir>/catalog.json   the data the website loads (menu, filters, items)
    <out_dir>/seed.sql       the same data as SQL inserts for Postgres/Supabase
"""
import hashlib
import json
import re
import sys
from pathlib import Path

import pandas as pd

DEPT_ORDER = ["Electrical", "Appliances", "Plumbing", "Paint", "Tools", "Hardware & Fixings",
              "Motors & Pumps", "Agri & Borewell", "Safety"]
DEPT_TA = {
    "Electrical": "மின்சாதனங்கள்", "Appliances": "வீட்டு உபகரணங்கள்", "Plumbing": "பிளம்பிங்",
    "Paint": "பெயிண்ட்", "Tools": "கருவிகள்", "Hardware & Fixings": "ஹார்டுவேர் & பொருத்திகள்",
    "Motors & Pumps": "மோட்டார் & பம்ப்", "Agri & Borewell": "விவசாயம் & ஆழ்துளை கிணறு",
    "Safety": "பாதுகாப்பு",
}
# Departments whose sizes are pipe sizes, so 3/4" and 20 mm / 25 mm mean the same item.
PIPE_DEPTS = {"Plumbing", "Agri & Borewell"}
# Pipe size tables used by Indian shops. Inch size -> mm, per material family.
# PVC (agri / SWR) is sold by outside diameter; UPVC/CPVC by CTS; metal pipe by nominal bore.
MM = {
    "pvc": {"1/2": 20, "3/4": 25, "1": 32, "1-1/4": 40, "1-1/2": 50, "2": 63, "2-1/2": 75, "3": 90,
            "4": 110, "5": 140, "6": 160},
    "cts": {"1/2": 15, "3/4": 20, "1": 25, "1-1/4": 32, "1-1/2": 40, "2": 50},
    "nb": {"1/2": 15, "3/4": 20, "1": 25, "1-1/4": 32, "1-1/2": 40, "2": 50, "2-1/2": 65, "3": 80,
           "4": 100, "5": 125, "6": 150},
}
MATERIALS = [("UPVC", r"u\.?pvc"), ("CPVC", r"c\.?pvc"), ("SWR", r"\bswr\b"), ("PVC", r"pvc"),
             ("GI", r"\bgi\b"), ("Stainless Steel", r"\bss\b|stainless"), ("Brass", r"brass|bross|brose"),
             ("CP (Chrome)", r"\bcp\b|chrome"), ("CI (Cast Iron)", r"\bci\b"), ("MS (Mild Steel)", r"\bms\b"),
             ("HDPE", r"hdpe")]
FAMILY = {"PVC": "pvc", "SWR": "pvc", "UPVC": "cts", "CPVC": "cts"}
UPPER = {"upvc", "cpvc", "pvc", "gi", "ss", "ms", "ci", "cp", "mta", "fta", "swr", "isi", "led", "mcb",
         "rccb", "elcb", "hp", "ro", "tv", "lan", "ug", "pp", "hdpe", "dp", "sp", "tp", "skf", "nbc", "mrf"}
COLOURS = {"Black": "#222", "Wood": "#8b5a2b", "White": "#fff", "Grey": "#8a8f98", "Green": "#2e8b57",
           "Gold": "#c9a227", "Brown": "#6b4226", "Red": "#c62828", "Ivory": "#f3ecd6", "Yellow": "#f2c200",
           "Silver": "#c0c0c0", "Blue": "#1e5bb8"}


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", str(s).lower()).strip("-")


def clean(v):
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return ""
    return str(v).strip()


def inch_token(v):
    """'1 1/2' -> '1-1/2', '3/4' -> '3/4', '2' -> '2'."""
    return v.strip().replace('"', "").replace(" ", "-")


def size_tokens(dept, material, size_in, size_mm):
    """All size spellings an item answers to, e.g. ['3/4in', '25mm']."""
    inches = [inch_token(p) for p in size_in.split(" x ")] if size_in else []
    mms = [float(p) for p in re.findall(r"\d+(?:\.\d+)?", size_mm)] if size_mm else []
    out = [i + "in" for i in inches] + [f"{m:g}mm" for m in mms]
    if dept in PIPE_DEPTS:
        table = MM[FAMILY.get(material, "nb")]
        out += [f"{table[i]}mm" for i in inches if i in table]
        back = {v: k for k, v in table.items()}
        out += [back[m] + "in" for m in mms if m in back]
    return list(dict.fromkeys(out))


def nice_fraction(m):
    whole, frac = m.group(1), m.group(2)
    return f"{whole} {frac}"


def display_name(n):
    s = n.replace("''", '"').replace("”", '"')
    s = re.sub(r"\b(\d)(\d/[248])(?=\s*[\"*xX])", nice_fraction, s)   # 11/2" -> 1 1/2"
    s = re.sub(r"\b(\d)(\d/[248])(?=\*)", nice_fraction, s)
    s = re.sub(r"\s*\*\s*", " x ", s)
    s = re.sub(r"\"(?=[A-Za-z])", '" ', s)
    s = re.sub(r"\s+", " ", s).strip()
    words = []
    for w in s.split(" "):
        if w.lower() in UPPER:
            words.append(w.upper())
        elif w.islower() and w.isalpha() and w != "x":
            words.append(w.capitalize())
        else:
            words.append(w)
    return " ".join(words)


def material_of(name, given):
    if given:
        return given
    for k, p in MATERIALS:
        if re.search(p, name, re.I):
            return k
    return ""


def sku_of(name, seen):
    base = "SA" + hashlib.sha1(name.encode()).hexdigest()[:6].upper()
    sku, n = base, 2
    while sku in seen:
        sku, n = f"{base}-{n}", n + 1
    seen.add(sku)
    return sku


def price(v):
    try:
        f = float(v)
    except (TypeError, ValueError):
        return 0
    return round(f, 2) if f > 0 else 0


def build(xlsx):
    items = pd.read_excel(xlsx, sheet_name="All Items")
    menu = pd.read_excel(xlsx, sheet_name="Menu")
    items = items[items["Department"].isin(DEPT_ORDER)]

    types, type_index = [], {}
    depts = []
    for d in DEPT_ORDER:
        dm = menu[menu["Department"] == d]
        groups = []
        for g, gm in dm.groupby("Group", sort=True):
            tlist = []
            for _, r in gm.iterrows():
                filters = [f.strip() for f in str(r["Filters shown on this page"]).split(",")]
                filters = [f for f in filters if f and f != "Price"]
                # Size first, like the big trade sites: size filters lead, then the rest in sheet order.
                filters.sort(key=lambda f: 0 if re.search(r"size|sweep", f, re.I) else 1)
                t = {"id": len(types), "slug": slug(f"{d}-{r['Product Type (new)']}"), "name": r["Product Type (new)"],
                     "group": g, "dept": d, "filters": filters}
                type_index[(d, g, r["Product Type (new)"])] = t["id"]
                types.append(t)
                tlist.append(t["id"])
            groups.append({"name": g, "slug": slug(f"{d}-{g}"), "types": tlist})
        depts.append({"name": d, "ta": DEPT_TA[d], "slug": slug(d), "groups": groups})

    out, seen = [], set()
    for _, r in items.iterrows():
        name = clean(r["Item Name"])
        if not name:
            continue
        d, g, t = r["Department"], r["Group"], r["Product Type"]
        tid = type_index.get((d, g, t))
        if tid is None:
            continue
        ty = types[tid]
        mat = material_of(name, clean(r.get("Material"))) if d in PIPE_DEPTS or "Material" in ty["filters"] else clean(r.get("Material"))
        attrs = {}
        for f in ty["filters"]:
            v = mat if f == "Material" else clean(r.get(f))
            if v:
                attrs[f] = v
        if mat and d in PIPE_DEPTS:
            attrs.setdefault("Material", mat)
        p, mrp = price(r["Selling Price (Rs)"]), price(r["MRP (Rs)"])
        it = {
            "sku": sku_of(name, seen), "n": display_name(name), "raw": name, "t": tid,
            "b": clean(r["Brand"]) or "Unbranded", "p": p, "u": clean(r["Units"]) or "pcs",
            "a": attrs, "sz": size_tokens(d, mat, clean(r.get("Size (inch)")), clean(r.get("Size (mm)"))),
        }
        if mrp > p:
            it["mrp"] = mrp
        if mat:
            it["m"] = mat
        col = clean(r.get("Colour / finish")) or clean(r.get("Fan colour"))
        if col in COLOURS:
            it["c"] = col
        if clean(r.get("Check (ok / review / guess)")) != "ok":
            it["rv"] = 1
        out.append(it)

    counts = {}
    for it in out:
        counts[it["t"]] = counts.get(it["t"], 0) + 1
    for t in types:
        t["count"] = counts.get(t["id"], 0)
    return {"depts": depts, "types": types, "items": out, "colours": COLOURS}


def sql_str(v):
    if v is None or v == "":
        return "null"
    return "'" + str(v).replace("'", "''") + "'"


def sql_arr(xs):
    return "array[" + ",".join(sql_str(x) for x in xs) + "]::text[]" if xs else "'{}'::text[]"


def seed_sql(cat):
    lines = ["-- Generated by tools/build_catalog.py. Load after schema.sql.", "begin;",
             "truncate order_items, orders, products, product_types, product_groups, departments restart identity cascade;"]
    gid = 0
    for i, d in enumerate(cat["depts"], 1):
        lines.append(f"insert into departments (id, slug, name, name_ta, sort) values ({i}, {sql_str(d['slug'])}, {sql_str(d['name'])}, {sql_str(d['ta'])}, {i});")
        for j, g in enumerate(d["groups"], 1):
            gid += 1
            lines.append(f"insert into product_groups (id, department_id, slug, name, sort) values ({gid}, {i}, {sql_str(g['slug'])}, {sql_str(g['name'])}, {j});")
            for k, tid in enumerate(g["types"], 1):
                t = cat["types"][tid]
                lines.append(f"insert into product_types (id, group_id, slug, name, filters, sort) values ({tid + 1}, {gid}, {sql_str(t['slug'])}, {sql_str(t['name'])}, {sql_arr(t['filters'])}, {k});")
    for it in cat["items"]:
        lines.append(
            "insert into products (sku, item_name, title, type_id, brand, material, colour, sizes, attrs, price_inr, mrp_inr, unit, needs_review) values ("
            f"{sql_str(it['sku'])}, {sql_str(it['raw'])}, {sql_str(it['n'])}, {it['t'] + 1}, {sql_str(it['b'])}, {sql_str(it.get('m'))}, "
            f"{sql_str(it.get('c'))}, {sql_arr(it['sz'])}, {sql_str(json.dumps(it['a'], ensure_ascii=False))}::jsonb, "
            f"{it['p'] or 'null'}, {it.get('mrp') or 'null'}, {sql_str(it['u'])}, {'true' if it.get('rv') else 'false'});")
    for tbl in ("departments", "product_groups", "product_types"):
        lines.append(f"select setval(pg_get_serial_sequence('{tbl}', 'id'), (select max(id) from {tbl}));")
    lines.append("commit;")
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    src, dst = sys.argv[1], Path(sys.argv[2])
    dst.mkdir(parents=True, exist_ok=True)
    cat = build(src)
    (dst / "catalog.json").write_text(json.dumps(cat, ensure_ascii=False, separators=(",", ":")))
    (dst / "seed.sql").write_text(seed_sql(cat))
    print(f"{len(cat['items'])} items, {len(cat['types'])} product types -> {dst}")
