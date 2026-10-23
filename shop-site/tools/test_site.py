"""Browser tests for the shop site, one per check in the page spec.

Usage:
    python3 tools/test_site.py <site_url> <out_dir>
e.g. python3 -m http.server 8765 -d site &  python3 tools/test_site.py http://localhost:8765/ /tmp/results

Writes <out_dir>/results.json (check, pass/fail, detail) and screenshots used by the comparison page.
Needs: pip install playwright (uses the Chromium at $CHROMIUM or /opt/pw-browsers/chromium).
"""
import asyncio
import json
import os
import re
import sys
from pathlib import Path

from playwright.async_api import async_playwright

URL, OUT = sys.argv[1].rstrip("/") + "/", Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
RESULTS = []


def check(area, name, ok, detail=""):
    RESULTS.append({"area": area, "check": name, "pass": bool(ok), "detail": detail})
    print(("PASS " if ok else "FAIL ") + f"[{area}] {name}" + (f" - {detail}" if detail else ""))


async def count(page):
    return int(await page.locator(".results-bar .count b").first.inner_text())


async def skus(page):
    return await page.eval_on_selector_all(".grid .card", "els => els.map(e => e.dataset.sku)")


async def prices(page):
    return await page.eval_on_selector_all(".grid .card", """els => els.map(e => {
        const p = e.querySelector('.price'); return p ? +p.textContent.replace(/[^\\d.]/g, '') : null })""")


async def goto(page, hash_):
    await page.goto(URL + hash_)
    await page.wait_for_selector("#main :is(.listing, .hero, .pdp, .qo-steps, .basket, .empty, h1)")
    await page.wait_for_timeout(150)


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path=os.environ.get("CHROMIUM", "/opt/pw-browsers/chromium"))
        page = await browser.new_page(viewport={"width": 1366, "height": 900})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))

        # ---- header ----
        await goto(page, "#/")
        check("Header", "Utility bar has a help link on the left", await page.locator(".topbar a[href='#/help']").count() == 1)
        check("Header", "Utility bar has the inc/ex GST switch on the right", await page.locator(".topbar-right #gst-toggle").count() == 1)
        check("Header", "Logo on the left, big search box with button", await page.locator(".header .logo").count() == 1 and await page.locator("#search-form button[type=submit]").count() == 1)
        labels = [x.strip() for x in await page.locator(".hdr-btn span").all_inner_texts()]
        check("Header", "Account, Store and Basket icon buttons with labels", all(l in labels for l in ["Account", "Our shop", "Basket"]), ", ".join(labels))
        tops = await page.eval_on_selector_all(".nav-list a", "els => els.map(e => Math.round(e.getBoundingClientRect().top))")
        check("Menu", "One row of top-level departments", len(tops) == 9 and len(set(tops)) == 1, f"{len(tops)} departments")
        await page.hover("a[data-dept=electrical]")
        await page.wait_for_selector("#mega:not([hidden])")
        cols = await page.locator(".mega-in > div").count()
        coltops = await page.eval_on_selector_all(".mega-in > div", "els => els.map(e => Math.round(e.getBoundingClientRect().top))")
        viewall = await page.locator(".mega-in .viewall").count()
        check("Menu", "Hover opens the mega menu with one column per group", cols >= 5 and len(set(coltops)) == 1, f"{cols} columns in one row")
        check("Menu", "Every column has a View all link", viewall == cols)
        await page.screenshot(path=str(OUT / "ours-mega.png"), clip={"x": 0, "y": 110, "width": 1366, "height": 600})
        await page.mouse.move(683, 880)
        await page.wait_for_timeout(400)
        check("Menu", "Menu closes when the mouse leaves", await page.locator("#mega[hidden]").count() == 1)
        strip = await page.locator("#promise a").count()
        check("Benefits strip", "3-4 short promises, each a link", 3 <= strip <= 4, f"{strip} links")
        box = await page.locator(".promise").bounding_box()
        await page.screenshot(path=str(OUT / "ours-promise.png"), clip={"x": 0, "y": box["y"], "width": 1366, "height": box["height"]})
        check("Promo bar", "Full-width bar with one call to action", await page.locator("a.promo .cta").count() == 1)

        # ---- category page ----
        base = "#/c/plumbing-upvc-fittings"
        await goto(page, base)
        crumbs = await page.locator(".crumbs a").count()
        check("Breadcrumb", "Home > Department > Group > Product type", crumbs == 3 and await page.locator(".crumbs span:not(.sep)").last.inner_text() == "UPVC Fittings")
        total = await count(page)
        intro = await page.locator(".intro h1").inner_text()
        check("Sidebar", "Category intro: title with product count", str(total) in intro, intro)
        await page.click("[data-readmore]")
        check("Sidebar", "Short text with a Read more toggle", await page.locator(".intro.expanded").count() == 1)
        sub = await page.locator(".subcats a").count()
        check("Sidebar", "Sub-categories with counts and an arrow", sub >= 3 and await page.locator(".subcats small").count() == sub)
        first_facet = (await page.locator(".facet > button").first.inner_text()).strip().upper()
        check("Filters", "Size comes first for plumbing", first_facet.startswith("SIZE"), first_facet)
        upper = await page.eval_on_selector(".facet > button", "e => getComputedStyle(e).textTransform")
        check("Filters", "Filter groups are accordions with uppercase headers", upper == "uppercase")
        await page.click(".facet > button")
        closed = await page.locator(".facet.closed").first.is_visible()
        await page.click(".facet > button")
        check("Filters", "Accordion opens and closes", closed)

        # every option count equals the items shown when ticked
        bad, tried = [], 0
        for slug in ["plumbing-upvc-fittings", "paint-interior-emulsions", "electrical-house-wires"]:
            await goto(page, f"#/c/{slug}")
            opts = await page.eval_on_selector_all(".facet:not(.closed) .opts input", "els => els.map(e => [e.dataset.f, +e.closest('label').querySelector('.c').textContent.replace(/\\D/g, '')])")
            for f, n in opts[:12]:
                await page.click(f"input[data-f=\"{f.replace(chr(34), chr(92) + chr(34))}\"]")
                await page.wait_for_timeout(60)
                got = await count(page)
                tried += 1
                if got != n:
                    bad.append(f"{slug} {f}: says {n}, shows {got}")
                await goto(page, f"#/c/{slug}")
        check("Filters", "Each option's count equals the items it shows when ticked", not bad, f"{tried} options tried" + ("; " + "; ".join(bad[:4]) if bad else ""))

        await goto(page, base)
        await page.click("input[data-f='Size (inch)~3/4\"']")
        one = await count(page)
        brand = await page.locator(".facet").filter(has_text="BRAND").locator(".opts input").first.get_attribute("data-f")
        await page.click(f"input[data-f=\"{brand}\"]")
        two = await count(page)
        applied = await page.locator(".filters-head small").inner_text()
        check("Filters", "Ticking two filters narrows the list", total > one >= two > 0, f"{total} → {one} → {two}")
        check("Filters", "Filters header shows how many are applied", "2" in applied, applied)
        await page.click(".filters-head a")
        await page.wait_for_timeout(100)
        check("Filters", "Clear all resets the list", await count(page) == total and "0" in await page.locator(".filters-head small").inner_text())

        # brand list: about 6 then View all
        await goto(page, "#/c/electrical-house-wires")
        bf = page.locator(".facet").filter(has_text="BRAND")
        shown = await bf.locator(".opts input").count()
        more = bf.locator("[data-more]")
        has_more = await more.count() == 1
        if has_more:
            await more.click()
            await page.wait_for_timeout(100)
        after = await page.locator(".facet").filter(has_text="BRAND").locator(".opts input").count()
        check("Filters", "Brand shows 6 options and a View all button", shown == 6 and has_more and after > 6, f"{shown} then {after}")

        # price: preset bands + custom min-max
        await goto(page, base + "?pp=all")
        pf = page.locator(".facet").filter(has_text="PRICE")
        if "closed" in (await pf.get_attribute("class")):
            await pf.locator("> button").click()
        bands = await pf.locator(".opts input").count()
        await pf.locator("input[name=pmin]").fill("50")
        await pf.locator("input[name=pmax]").fill("200")
        await pf.locator(".btn-go").click()
        await page.wait_for_timeout(150)
        ps = await prices(page)
        check("Filters", "Price has preset bands and a custom ₹ min-max with Go", bands >= 2 and ps and all(50 <= x <= 200 for x in ps), f"{bands} bands, {len(ps)} items between ₹50 and ₹200")

        # sort
        res = []
        for key, fn in [("price-asc", lambda a: a == sorted(a)), ("price-desc", lambda a: a == sorted(a, reverse=True))]:
            await goto(page, f"{base}?pp=all&sort={key}")
            ps = [x for x in await prices(page) if x is not None]
            res.append((key, fn(ps)))
        for key, rev in [("brand-az", False), ("brand-za", True)]:
            await goto(page, f"{base}?pp=all&sort={key}")
            brands = await page.evaluate("[...document.querySelectorAll('.grid .card')].map(c => SHOP.ITEMS.find(i => i.sku === c.dataset.sku).b)")
            res.append((key, brands == sorted(brands, key=str, reverse=rev)))
        check("Sort", "Sort options reorder correctly by price and brand", all(ok for _, ok in res), ", ".join(f"{k} {'ok' if ok else 'WRONG'}" for k, ok in res))
        await goto(page, base)
        opts = await page.locator("#sort-top option").all_inner_texts()
        check("Sort", "Sort dropdown repeated at the bottom", await page.locator("#sort-bottom").count() == 1, " / ".join(opts))

        # results per page
        await goto(page, base)
        c20 = await page.locator(".grid .card").count()
        await page.locator(".perpage a", has_text="All").first.click()
        await page.wait_for_timeout(200)
        call = await page.locator(".grid .card").count()
        check("Results", "Results per page: 20 / All", c20 == 20 and call == total, f"20 → {c20} cards, All → {call} of {total}")
        bar = await page.locator(".results-bar").first.bounding_box()
        await page.screenshot(path=str(OUT / "ours-perpage.png"), clip={"x": bar["x"] + bar["width"] - 420, "y": bar["y"], "width": 420, "height": bar["height"]})
        ctops = await page.eval_on_selector_all(".grid .card", "els => els.slice(0, 2).map(e => Math.round(e.getBoundingClientRect().top))")
        check("Results", "Product grid is 2 columns on desktop", len(ctops) == 2 and ctops[0] == ctops[1])
        check("Results", "SEO text below the grid", await page.locator(".seo p").count() == 1)
        side = await page.locator(".side").bounding_box()
        await page.screenshot(path=str(OUT / "ours-filters.png"), clip={"x": side["x"], "y": side["y"] + 470, "width": side["width"], "height": 900}, full_page=True)

        # product card
        card = page.locator(".grid .card").first
        title = await card.locator("h3").inner_text()
        check("Product card", "Photo and title link with our item code", await card.locator(".img").count() == 1 and re.search(r"\(SA[0-9A-F]{6}", title) is not None, title)
        check("Product card", "Badge in the top-right corner when cheaper than MRP", await page.locator(".grid .card .badge").count() > 0)
        check("Product card", "3 bullet features", await card.locator(".feats li").count() == 3)
        check("Product card", "Big price with a small inc GST label", "inc GST" in await card.locator(".tax").inner_text())
        check("Product card", "MRP struck through when the price is lower", await page.locator(".grid .card s").count() > 0)
        await card.locator("[data-step='-1']").click()
        await card.locator("[data-step='-1']").click()
        v1 = await card.locator(".qty input").input_value()
        await card.locator(".qty input").fill("0")
        await card.locator(".qty input").dispatch_event("change")
        v2 = await card.locator(".qty input").input_value()
        await card.locator("[data-step='1']").click()
        v3 = await card.locator(".qty input").input_value()
        check("Product card", "Quantity stepper never goes below 1", v1 == "1" and v2 == "1" and v3 == "2", f"after −,−: {v1}; typed 0: {v2}; then +: {v3}")
        check("Product card", "Check stock at our shop link", await card.locator("a.stock").count() == 1)
        check("Product card", "Collect / Deliver choice", await card.locator(".fulfil input[type=radio]").count() == 2)
        bw = (await card.locator("[data-add]").bounding_box())["width"]
        cw = (await card.bounding_box())["width"]
        check("Product card", "Full-width Add to basket button plus WhatsApp button", bw > cw * 0.85 and await card.locator(".btn-wa").count() == 1)
        before = int(await page.locator("#basket-count").inner_text())
        await card.locator("[data-add]").click()
        check("Product card", "Add to basket updates the basket count", int(await page.locator("#basket-count").inner_text()) == before + 1)

        # GST toggle
        await goto(page, base)
        inc = await prices(page)
        await page.click("#gst-toggle")
        await page.wait_for_timeout(200)
        ex = await prices(page)
        ok = len(inc) == len(ex) and all(a is None or abs(b - round(a / 1.18, 2)) < 0.02 for a, b in zip(inc, ex))
        check("GST", "The inc/ex GST switch changes every price on the page", ok and "ex GST" in await page.locator(".grid .card .tax").first.inner_text(), f"{inc[0]} → {ex[0]}")
        await page.click("#gst-toggle")

        # size search
        sets = {}
        for q in ["3x4 upvc", "3/4 upvc", "20mm upvc", "upvc 3x4"]:
            await goto(page, f"#/search?q={q}&pp=all")
            sets[q] = set(await skus(page))
        same = len({frozenset(s) for s in sets.values()}) == 1 and len(sets["3x4 upvc"]) > 0
        check("Search", "3x4 upvc, 3/4 upvc and 20mm upvc return the same items", same, ", ".join(f"{q}: {len(s)}" for q, s in sets.items()))
        for q, want in [("11/2 pvc tee", '1 1/2"'), ("21/2 gi elbow", '2 1/2"')]:
            await goto(page, f"#/search?q={q}&pp=all")
            titles = await page.locator(".grid .card h3").all_inner_texts()
            check("Search", f"'{q}' finds {want} items", titles and all(want in t or want.replace(" ", "-") in t for t in titles[:5]), f"{len(titles)} found, first: {titles[0] if titles else '-'}")
        await goto(page, "#/search?q=4x2 reducer&pp=all")
        titles = await page.locator(".grid .card h3").all_inner_texts()
        check("Search", "'4x2 reducer' finds 4\" x 2\" reducers", titles and all(("4" in t and "2" in t) for t in titles[:5]), f"{len(titles)} found, first: {titles[0] if titles else '-'}")
        await page.fill("#search-input", "3x4 upvc")
        await page.wait_for_timeout(200)
        check("Search", "Search box suggests matches as you type", await page.locator("#suggest a").count() > 0 and "3/4" in await page.locator("#suggest .hint").inner_text())

        # quick order
        await goto(page, "#/quick-order?mat=UPVC&size=3/4in")
        rows = await page.locator(".qo-table tbody tr").count()
        inputs = page.locator("[data-qo]")
        await inputs.nth(0).fill("10")
        await inputs.nth(1).fill("5")
        lines = await page.locator("#qo-lines").inner_text()
        before = int(await page.locator("#basket-count").inner_text())
        await page.click("#qo-add")
        after = int(await page.locator("#basket-count").inner_text())
        check("Quick order", "Pick UPVC + 3/4\" shows every matching item with a quantity box", rows > 10, f"{rows} items")
        check("Quick order", "Typed quantities add to the basket in one go", lines == "2" and after - before in (1, 2), f"{lines} lines, basket {before} → {after}")
        await goto(page, "#/quick-order?mat=UPVC")
        await page.fill("#qo-type input", "3x4")
        await page.click("#qo-type button")
        await page.wait_for_timeout(200)
        check("Quick order", "Typing 3x4 picks the 3/4\" size", "size=3%2F4in" in page.url or "size=3/4in" in page.url, page.url.split("#")[1])
        await page.screenshot(path=str(OUT / "ours-quickorder.png"))

        # basket
        await goto(page, "#/basket")
        check("Basket", "Basket lists items with a checkout form", await page.locator(".bl-row").count() >= 2 and await page.locator("#checkout input[name=phone]").count() == 1)

        # Tamil
        await page.click("#lang-btn")
        await page.wait_for_timeout(200)
        tam = await page.locator(".nav-list a").first.inner_text()
        check("Language", "Tamil switch changes the menu", re.search(r"[஀-௿]", tam) is not None, tam)
        await page.click("#lang-btn")

        # product page
        await goto(page, base)
        await page.locator(".grid .card h3 a").first.click()
        await page.wait_for_selector(".pdp")
        check("Product page", "Product page with specifications table", await page.locator(".specs tr").count() >= 4)

        # phone width
        m = await browser.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        m.on("pageerror", lambda e: errors.append(str(e)))
        await m.goto(URL + base)
        await m.wait_for_selector(".listing")
        wide = await m.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
        await m.click(".mob-filter button")
        drawer = await m.locator(".side.drawer").is_visible()
        await m.locator(".side.drawer .opts input").first.click()
        await m.wait_for_timeout(200)
        still = await m.locator(".side.drawer").count() == 1
        txt = await m.locator(".drawer-apply button").inner_text()
        await m.click(".drawer-apply button")
        closed = await m.locator(".side.drawer").count() == 0
        n = await m.locator(".mob-filter button").inner_text()
        check("Phone", "Works at phone width: no sideways scrolling", not wide)
        check("Phone", "Filter (n) button opens a drawer that stays open while ticking", drawer and still and closed and "(1)" in n, f"{txt}; button now '{n}'")
        await m.goto(URL + "#/")
        await m.wait_for_selector(".hero")
        await m.click("#menu-btn")
        await m.locator(".nav-list a").nth(2).click()
        await m.wait_for_timeout(200)
        check("Phone", "Menu button opens departments, tapping one shows its groups", await m.locator("#mega:not([hidden]) .mega-in > div").count() > 3)

        check("Quality", "No script errors on any page", not errors, "; ".join(errors[:3]))
        await browser.close()

    (OUT / "results.json").write_text(json.dumps(RESULTS, indent=1, ensure_ascii=False))
    failed = [r for r in RESULTS if not r["pass"]]
    print(f"\n{len(RESULTS) - len(failed)}/{len(RESULTS)} checks pass")
    sys.exit(1 if failed else 0)


asyncio.run(main())
