"""Build the comparison page: reference screenshots next to ours, with pass/fail per check.

Usage:
    python3 tools/make_comparison.py <results_dir> <reference_dir> <out_dir>

<results_dir>   output of test_site.py (results.json + ours-*.png)
<reference_dir> reference screenshots named ref-mega.png, ref-promise.png, ref-perpage.png, ref-filters.png
                (ref-filters-2.png optional). They are copied next to the page, never committed.
"""
import html
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

res_dir, ref_dir, out = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
out.mkdir(parents=True, exist_ok=True)
results = json.loads((res_dir / "results.json").read_text())

PAIRS = [
    ("Mega menu", "mega", "Hover a department: a column per group, product types underneath, View all at the bottom of each column.",
     ["Menu"]),
    ("Promise strip", "promise", "Short selling points in one row under the menu, each one a link.", ["Benefits strip", "Promo bar"]),
    ("Results per page", "perpage", "20 or All, with the current choice filled in.", ["Results"]),
    ("Filter panel", "filters", "Collapsible groups with uppercase headers, a tick box per option and a count in brackets. Size first for plumbing.",
     ["Filters", "Sidebar"]),
]

for f in list(res_dir.glob("ours-*.png")) + list(ref_dir.glob("ref-*.png")):
    shutil.copy(f, out / f.name)

e = html.escape
passed = sum(r["pass"] for r in results)
areas = []
for r in results:
    if r["area"] not in areas:
        areas.append(r["area"])


def rows(area_list):
    return "".join(
        f'<li class="{"ok" if r["pass"] else "bad"}"><span class="pill">{"Pass" if r["pass"] else "Fail"}</span>'
        f'<span class="what">{e(r["check"])}</span>{f"<span class=detail>{e(r["detail"])}</span>" if r["detail"] else ""}</li>'
        for r in results if r["area"] in area_list)


pairs = ""
for title, key, note, area_list in PAIRS:
    refs = sorted(p.name for p in out.glob(f"ref-{key}*.png"))
    ref_imgs = "".join(f'<img src="{n}" alt="Reference: {e(title)}" loading="lazy">' for n in refs) or '<p class="none">No reference screenshot yet</p>'
    pairs += f"""
    <section class="pair">
      <header><h2>{e(title)}</h2><p>{e(note)}</p></header>
      <div class="cols">
        <figure><figcaption>Reference (Chandru's screenshot)</figcaption><div class="shot">{ref_imgs}</div></figure>
        <figure><figcaption>Our site</figcaption><div class="shot"><img src="ours-{key}.png" alt="Our site: {e(title)}" loading="lazy"></div></figure>
      </div>
      <ul class="checks">{rows(area_list)}</ul>
    </section>"""

shown = {a for _, _, _, al in PAIRS for a in al}
rest = [a for a in areas if a not in shown]
others = "".join(f'<section class="group"><h3>{e(a)}</h3><ul class="checks">{rows([a])}</ul></section>' for a in rest)
stamp = datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC")

page = f"""<title>Shop Site Check</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;800&family=Source+Sans+3:wght@400;600&display=swap">
<style>
/* Layout: a score band, then one block per reference screenshot (theirs left, ours right, checks below), then the remaining checks. */
:root {{
  --bg: #f3f5f8; --surface: #ffffff; --ink: #14263a; --muted: #5a6878; --line: #d6dde6;
  --accent: #0b3d6e; --amber: #f2a20c; --ok: #12773a; --ok-bg: #e3f3e8; --bad: #b42318; --bad-bg: #fbe7e5;
  --display: "Barlow Condensed", "Arial Narrow", sans-serif; --body: "Source Sans 3", "Segoe UI", Arial, sans-serif;
}}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{
  --bg: #0e1620; --surface: #16212e; --ink: #e5ecf3; --muted: #9aabbd; --line: #2a3a4c;
  --accent: #8cc0f2; --amber: #f5b53d; --ok: #6fd394; --ok-bg: #133423; --bad: #ff8a80; --bad-bg: #3a1714; color-scheme: dark; }} }}
:root[data-theme="dark"] {{
  --bg: #0e1620; --surface: #16212e; --ink: #e5ecf3; --muted: #9aabbd; --line: #2a3a4c;
  --accent: #8cc0f2; --amber: #f5b53d; --ok: #6fd394; --ok-bg: #133423; --bad: #ff8a80; --bad-bg: #3a1714; color-scheme: dark; }}
body {{ background: var(--bg); color: var(--ink); font: 16px/1.5 var(--body); }}
.page {{ max-width: 1240px; margin: 0 auto; padding-block: 28px 60px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: grid; gap: 28px; }}
h1, h2, h3 {{ font-family: var(--display); text-wrap: balance; margin: 0; }}
h1 {{ font-size: 40px; font-weight: 800; letter-spacing: .3px; text-transform: uppercase; color: var(--accent); }}
.lead {{ margin: 6px 0 0; color: var(--muted); max-width: 68ch; }}
.score {{ display: flex; flex-wrap: wrap; gap: 18px 32px; align-items: baseline; border-top: 4px solid var(--amber); padding-top: 16px; }}
.score b {{ font: 800 56px/1 var(--display); color: var(--ok); font-variant-numeric: tabular-nums; }}
.score span {{ color: var(--muted); }}
.pair {{ display: grid; gap: 14px; background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 20px; }}
.pair header p {{ margin: 2px 0 0; color: var(--muted); }}
h2 {{ font-size: 26px; font-weight: 800; text-transform: uppercase; letter-spacing: .4px; }}
h3 {{ font-size: 20px; font-weight: 600; text-transform: uppercase; letter-spacing: .6px; color: var(--muted); }}
.cols {{ display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }}
figure {{ margin: 0; min-width: 0; display: grid; gap: 6px; align-content: start; }}
figcaption {{ font: 600 13px var(--body); text-transform: uppercase; letter-spacing: .8px; color: var(--muted); }}
.shot {{ border: 1px solid var(--line); border-radius: 6px; background: #fff; overflow: auto; max-height: 560px; display: flex; gap: 8px; align-items: flex-start; }}
.shot img {{ max-width: 100%; height: auto; }}
.shot img + img {{ max-width: 49%; }}
.shot:has(img + img) img {{ max-width: 49%; }}
.none {{ padding: 20px; color: var(--muted); }}
.checks {{ list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }}
.checks li {{ display: grid; grid-template-columns: 52px minmax(0, 1fr); gap: 2px 12px; align-items: baseline; }}
.pill {{ grid-row: span 2; font: 600 12px/1 var(--body); text-transform: uppercase; letter-spacing: .6px; text-align: center; padding: 5px 0; border-radius: 4px; }}
.ok .pill {{ background: var(--ok-bg); color: var(--ok); }}
.bad .pill {{ background: var(--bad-bg); color: var(--bad); }}
.detail {{ grid-column: 2; color: var(--muted); font-size: 14px; overflow-wrap: anywhere; }}
.groups {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }}
.group {{ background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 16px 18px; display: grid; gap: 10px; align-content: start; }}
.foot {{ color: var(--muted); font-size: 14px; }}
@media (max-width: 760px) {{ .cols {{ grid-template-columns: 1fr; }} h1 {{ font-size: 32px; }} .groups {{ grid-template-columns: 1fr; }} }}
</style>
<main class="page">
  <div>
    <h1>Shop site check</h1>
    <p class="lead">Each block puts one of Chandru's reference screenshots next to the same part of our site, with the automatic browser checks for that part underneath. Every check clicks the real page in a browser: menus, filters, sort, the GST switch, size search, quick order and the phone layout.</p>
  </div>
  <div class="score"><b>{passed}/{len(results)}</b><span>checks pass · run {stamp} · same layout ideas, our own name, colours and items</span></div>
  {pairs}
  <h2>Other checks</h2>
  <div class="groups">{others}</div>
  <p class="foot">Checks come from the category page spec. Re-run with tools/test_site.py, then rebuild this page with tools/make_comparison.py.</p>
</main>
"""
(out / "index.html").write_text(page)
print(f"{passed}/{len(results)} pass -> {out / 'index.html'}")
