"""One-step website update from the shop's item list.

Usage:
    python3 tools/update_website.py <website_items.xlsx> [--busy item.xlsx] [--out site/data] [--db database.txt]

What it does, in order:
 1. Opens the website item list (the sorted workbook: Department > Group > Product Type).
    Adds a "Show on website" column (Yes/No) and a "Website Settings" sheet the first time.
 2. With --busy (a fresh item export from Busy): updates prices, MRP and units of known items,
    sorts new items into categories with the same rules used for the first sort, and marks items
    that are no longer in Busy.
 3. Saves the workbook (a backup of the old one goes in backups/ next to it).
 4. Builds the website data from the items that should show: Show on website = Yes, department and
    brand not switched off in Website Settings.
 5. With --db (a file holding the Supabase / Postgres connection string): brings the database in line.
Writes update-report.txt next to the workbook.
"""
import argparse
import difflib
import json
import re
import shutil
import subprocess
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path

import pandas as pd
from openpyxl.styles import Font
from openpyxl.worksheet.datavalidation import DataValidation

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE / "sorting"))
import build_catalog as bc  # noqa: E402
from filters import SHAPE, X, filters_for  # noqa: E402
from rules import DEPT_NAME, R  # noqa: E402

SHOW = "Show on website"
IN_BUSY = "In Busy list"
CHECK = "Check (ok / review / guess)"
SETTINGS = "Website Settings"
YES = {"yes", "y", "true", "1", "show"}
RULES = {k: [(g, t, re.compile(p, re.I)) for g, t, p in v] for k, v in R.items()}
OLD_DEPT = {v: k for k, v in DEPT_NAME.items()}


def yes(v, default=True):
    if v is None or (isinstance(v, float) and pd.isna(v)) or str(v).strip() == "":
        return default
    return str(v).strip().lower() in YES


def norm(name):
    return re.sub(r"\s+", " ", str(name)).strip().lower()


# ---------- reading a Busy export ----------
COLS = {
    "name": r"^(item\s*)?name$|^particulars$|^item$|^product( name)?$",
    "price": r"^(sales?|selling)\s*(price|rate)?(\s*\(rs\))?$|^rate$|^price$",
    "mrp": r"^mrp(\s*\(rs\))?$",
    "unit": r"^units?$|^uom$|^main unit$",
    "group": r"^(parent\s*)?group$|^item group$|^current group$",
}


def read_busy(path):
    """The item export from Busy, wherever its header row is. Returns name, price, mrp, unit, group."""
    raw = pd.read_excel(path, header=None, sheet_name=0)
    for r in range(min(20, len(raw))):
        heads = [str(x).strip().lower() for x in raw.iloc[r]]
        if any(re.search(COLS["name"], h) for h in heads):
            break
    else:
        sys.exit(f"Could not find an 'Item Name' column in {path}")
    df = raw.iloc[r + 1:].copy()
    df.columns = heads
    out = pd.DataFrame()
    for key, pat in COLS.items():
        col = next((h for h in heads if re.search(pat, h)), None)
        out[key] = df[col].values if col else ""
    out = out[out["name"].astype(str).str.strip().ne("") & out["name"].notna()]
    out["name"] = out["name"].astype(str).str.strip()
    return out.drop_duplicates("name")


# ---------- sorting new items ----------
def classify(name, busy_group, items):
    """Department, Group, Product Type for an item that is new to the list, and how sure we are."""
    hay = name
    # 1. items from the same Busy group tell us the old department; use its rules
    same = items[items["Old Group (Busy)"].astype(str).str.lower() == str(busy_group).strip().lower()] if busy_group else items.iloc[0:0]
    if len(same):
        old = Counter(same["Old Department"].dropna()).most_common(1)
        if old and old[0][0] in RULES:
            for g, t, p in RULES[old[0][0]]:
                if p.pattern != ".*" and p.search(hay):
                    return DEPT_NAME.get(old[0][0], old[0][0]), g, t, "new"
    # 2. the closest existing item name
    near = difflib.get_close_matches(norm(name), items["_norm"].tolist(), n=1, cutoff=0.75)
    if near:
        r = items[items["_norm"] == near[0]].iloc[0]
        return r["Department"], r["Group"], r["Product Type"], "new"
    # 3. any department's rules
    for old, rules in RULES.items():
        for g, t, p in rules:
            if p.pattern != ".*" and "(other)" not in t and p.search(hay):
                return DEPT_NAME.get(old, old), g, t, "new (guess)"
    return "Hardware & Fixings", "General Hardware", "General Hardware (other)", "new (review)"


def tidy_category(d, g, t):
    """The same renames the first sort made (Indian naming)."""
    if g == "Fans & Appliances":
        d = "Appliances"
    if g == "Safety & Workwear":
        d = "Safety"
    t = {"Water Heaters": "Geysers (Water Heaters)", "House Wire": "House Wires"}.get(t, t)
    return d, g, t


def brand_of(name, brands):
    low = name.lower()
    for b in brands:
        if re.search(r"(?<![a-z])" + re.escape(b.lower()) + r"(?![a-z])", low):
            return b
    return "Unbranded"


# ---------- the workbook ----------
def load(path):
    sheets = pd.read_excel(path, sheet_name=None)
    items = sheets["All Items"]
    if SHOW not in items:
        items.insert(1, SHOW, "Yes")
    if IN_BUSY not in items:
        items.insert(2, IN_BUSY, "")
    if SETTINGS not in sheets:
        depts = [d for d in bc.DEPT_ORDER if d in set(items["Department"])]
        brands = sorted(set(items["Brand"].dropna()) - {"Unbranded"}, key=str.lower)
        sheets[SETTINGS] = pd.DataFrame(
            [["Setting", "New items from Busy show on website", "Yes"],
             ["Setting", "Hide items no longer in Busy", "Yes"]]
            + [["Department", d, "Yes"] for d in depts] + [["Brand", b, "Yes"] for b in brands],
            columns=["Kind", "Name", "Show on website (Yes / No)"])
    return sheets


def settings(sheets):
    s = sheets[SETTINGS]
    val = {(str(k), str(n)): yes(v) for k, n, v in s.iloc[:, :3].itertuples(index=False)}
    hide_depts = {n for (k, n), v in val.items() if k == "Department" and not v}
    hide_brands = {n for (k, n), v in val.items() if k == "Brand" and not v}
    return {"new_show": val.get(("Setting", "New items from Busy show on website"), True),
            "hide_gone": val.get(("Setting", "Hide items no longer in Busy"), True),
            "hide_depts": hide_depts, "hide_brands": hide_brands}


def merge_busy(sheets, busy, cfg, report):
    items, menu = sheets["All Items"], sheets["Menu"]
    items["_norm"] = items["Item Name"].map(norm)
    b = busy.set_index(busy["name"].map(norm))
    known = items["_norm"].isin(b.index)
    items[IN_BUSY] = known.map({True: "Yes", False: "No"})
    changed = 0
    for i in items.index[known]:
        r = b.loc[items.at[i, "_norm"]]
        for col, key in [("Selling Price (Rs)", "price"), ("MRP (Rs)", "mrp")]:
            new = bc.price(r[key])
            if new and bc.price(items.at[i, col]) != new:
                items.at[i, col] = new
                changed += 1 if col == "Selling Price (Rs)" else 0
        if str(r["unit"]).strip() not in ("", "nan"):
            items.at[i, "Units"] = str(r["unit"]).strip()
    report.append(f"Prices changed: {changed}")
    report.append(f"Items no longer in Busy: {(~known).sum()}" + (" (hidden from the website)" if cfg["hide_gone"] else " (still shown)"))

    brands = sorted(set(items["Brand"].dropna()) - {"Unbranded"}, key=len, reverse=True)
    new_rows = []
    for key, r in b[~b.index.isin(items["_norm"])].iterrows():
        name = r["name"]
        d, g, t, how = classify(name, r["group"], items)
        d, g, t = tidy_category(d, g, t)
        row = {"Item Name": name, SHOW: "Yes" if cfg["new_show"] else "No", IN_BUSY: "Yes",
               "Department": d, "Group": g, "Product Type": t, "Brand": brand_of(name, brands),
               "Selling Price (Rs)": bc.price(r["price"]) or None, "MRP (Rs)": bc.price(r["mrp"]) or None,
               "Units": str(r["unit"]).strip() if str(r["unit"]).strip() not in ("", "nan") else "pcs",
               "Old Group (Busy)": r["group"], "Old Department": OLD_DEPT.get(d, d), CHECK: how}
        for f in filters_for(g, t):
            if f in X:
                row[f] = X[f](name)
        if g == "Pipe Fittings" and not row.get("Fitting Shape"):
            row["Fitting Shape"] = SHAPE(name)
        new_rows.append(row)
        if not ((menu["Department"] == d) & (menu["Group"] == g) & (menu["Product Type (new)"] == t)).any():
            menu.loc[len(menu)] = {"Department": d, "Group": g, "Product Type (new)": t, "Items": 0,
                                   "Filters shown on this page": ", ".join(filters_for(g, t)) + ", Price"}
    if new_rows:
        items = pd.concat([items, pd.DataFrame(new_rows)], ignore_index=True)
    report.append(f"New items added: {len(new_rows)}" + ("" if cfg["new_show"] else " (not shown until you set them to Yes)"))
    for r in new_rows[:30]:
        report.append(f"    {r['Item Name']}  ->  {r['Department']} > {r['Group']} > {r['Product Type']}")
    if len(new_rows) > 30:
        report.append(f"    ... and {len(new_rows) - 30} more (see the Needs Review sheet)")
    sheets["All Items"] = items.drop(columns="_norm")
    sheets["Menu"] = menu


def visible(sheets, cfg):
    items = sheets["All Items"]
    keep = items[SHOW].map(yes)
    keep &= ~items["Department"].isin(cfg["hide_depts"])
    keep &= ~items["Brand"].isin(cfg["hide_brands"])
    if cfg["hide_gone"]:
        keep &= items[IN_BUSY].astype(str).str.strip().str.lower() != "no"
    return items[keep]


def save(sheets, path):
    items = sheets["All Items"]
    sheets["Needs Review"] = items[items[CHECK].astype(str) != "ok"]
    menu = sheets["Menu"]
    counts = Counter(zip(items["Department"], items["Group"], items["Product Type"]))
    menu["Items"] = [counts.get(k, 0) for k in zip(menu["Department"], menu["Group"], menu["Product Type (new)"])]
    readme = sheets.get("Read Me")
    tip = "Show on website: set an item to No to hide it. Website Settings: switch whole departments or brands off. Then double-click 'Update website'."
    if readme is not None and not readme.iloc[:, 0].astype(str).str.startswith("Show on website").any():
        readme.loc[len(readme)] = [tip]
    order = ["Read Me", SETTINGS, "Menu", "Filters", "All Items", "Needs Review"]
    order += [s for s in sheets if s not in order]
    tmp = path.with_suffix(".tmp.xlsx")
    with pd.ExcelWriter(tmp, engine="openpyxl") as w:
        for name in order:
            if name in sheets:
                sheets[name].to_excel(w, sheet_name=name, index=False)
        for ws in w.book.worksheets:
            ws.freeze_panes = "A2"
            ws.auto_filter.ref = ws.dimensions
            for col in ws.columns:
                ws.column_dimensions[col[0].column_letter].width = min(60, max(len(str(c.value or "")) for c in list(col)[:300]) + 2)
            for c in ws[1]:
                c.font = Font(bold=True)
        yn = DataValidation(type="list", formula1='"Yes,No"', allow_blank=True)
        w.book["All Items"].add_data_validation(yn)
        yn.add(f"B2:B{len(items) + 1}")
        yn2 = DataValidation(type="list", formula1='"Yes,No"', allow_blank=True)
        w.book[SETTINGS].add_data_validation(yn2)
        yn2.add(f"C2:C{len(sheets[SETTINGS]) + 1}")
    tmp.replace(path)


def push_db(sql_file, db_file, report):
    url = Path(db_file).read_text().strip()
    try:
        import psycopg
        with psycopg.connect(url) as conn:
            conn.execute(Path(sql_file).read_text())
    except ImportError:
        subprocess.run(["psql", url, "-q", "-v", "ON_ERROR_STOP=1", "-f", str(sql_file)], check=True, stdout=subprocess.DEVNULL)
    report.append("Database updated: the live website shows the changes now.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("workbook")
    ap.add_argument("--busy")
    ap.add_argument("--out", default=str(HERE.parent / "site" / "data"))
    ap.add_argument("--db")
    a = ap.parse_args()
    path = Path(a.workbook)
    report = [f"Website update {datetime.now():%d %b %Y %H:%M}", ""]

    sheets = load(path)
    cfg = settings(sheets)
    if a.busy:
        merge_busy(sheets, read_busy(a.busy), cfg, report)
    backups = path.parent / "backups"
    backups.mkdir(exist_ok=True)
    shutil.copy2(path, backups / f"{path.stem}-{datetime.now():%Y%m%d-%H%M%S}.xlsx")
    save(sheets, path)

    show = visible(sheets, cfg)
    cat = bc.build(items=show, menu=sheets["Menu"])
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / "catalog.json").write_text(json.dumps(cat, ensure_ascii=False, separators=(",", ":")))
    (out / "seed.sql").write_text(bc.seed_sql(cat))
    total = len(sheets["All Items"])
    report.append(f"On the website: {len(cat['items'])} of {total} items, {len(cat['depts'])} departments")
    if cfg["hide_depts"]:
        report.append("Departments switched off: " + ", ".join(sorted(cfg["hide_depts"])))
    if cfg["hide_brands"]:
        report.append(f"Brands switched off: {len(cfg['hide_brands'])}")
    report.append(f"Hidden one by one (Show on website = No): {(~sheets['All Items'][SHOW].map(yes)).sum()}")
    if a.db and Path(a.db).exists() and Path(a.db).read_text().strip():
        push_db(out / "seed.sql", a.db, report)
    else:
        report.append("No database set up yet: the website copy on this computer is updated.")
    text = "\n".join(report)
    (path.parent / "update-report.txt").write_text(text + "\n")
    print(text)


if __name__ == "__main__":
    main()
