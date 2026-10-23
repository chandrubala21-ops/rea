"""Browser tests for the shop site: the acceptance checks from the Shop Website Functional Spec.

Usage:
    python3 tools/test_site.py <site_url> <out_dir>
e.g. python3 -m http.server 8765 -d site &  python3 tools/test_site.py http://localhost:8765/ /tmp/results

Writes <out_dir>/results.json (area, check, pass/fail, detail) and screenshots used by the comparison page.
Needs: pip install playwright (uses the Chromium at $CHROMIUM or /opt/pw-browsers/chromium).
"""
import asyncio
import json
import os
import re
import sys
import time
from pathlib import Path
from urllib.parse import quote

from playwright.async_api import async_playwright

URL, OUT = sys.argv[1].rstrip("/") + "/", Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
RESULTS = []
TYPE = "#/c/plumbing-upvc-fittings"


def check(area, name, ok, detail=""):
    RESULTS.append({"area": area, "check": name, "pass": bool(ok), "detail": str(detail)})
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
    await page.wait_for_selector("#main :is(.listing, .hero, .pdp, .qo-steps, .basket, .empty, .cmp-wrap, h1)")
    await page.wait_for_timeout(120)


async def all_search(page, q):
    await goto(page, f"#/search?q={quote(q)}&pp=all")
    return set(await skus(page))


def opt(f):
    return f'a.opt[data-f="{f.replace(chr(34), chr(92) + chr(34))}"]'


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path=os.environ.get("CHROMIUM", "/opt/pw-browsers/chromium"))
        ctx = await browser.new_context(viewport={"width": 1366, "height": 900})
        page = await ctx.new_page()
        page.set_default_timeout(6000)
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))

        # ================= header and navigation =================
        await goto(page, "#/")
        await page.evaluate("window.__noReload = 1")
        labels = [x.strip() for x in await page.locator(".hdr-btn span").all_inner_texts()]
        check("Header", "Logo, search box, Account, Shop and Basket in the header", await page.locator(".header .logo").count() == 1 and all(l in labels for l in ["Account", "Our shop", "Basket"]), ", ".join(labels))
        check("Header", "Help link on the left, GST switch on the right of the top bar", await page.locator(".topbar a[href='#/help']").count() == 1 and await page.locator(".topbar-right #gst-toggle").count() == 1)
        await page.click("a[data-dept=plumbing]")
        await page.wait_for_selector(".dept-hero")
        await page.locator(".gtile a").first.click()
        await page.wait_for_selector(".listing .grid")
        same = await page.evaluate("window.__noReload === 1")
        check("Header", "Moves between pages without a full page reload, header stays", same and await page.locator(".header .logo").count() == 1)
        tops = await page.eval_on_selector_all(".nav-list a", "els => els.map(e => Math.round(e.getBoundingClientRect().top))")
        check("Menu", "One row of departments", len(tops) == 9 and len(set(tops)) == 1, f"{len(tops)} departments")
        await goto(page, TYPE)
        t0 = time.perf_counter()
        await page.hover("a[data-dept=electrical]")
        await page.wait_for_selector("#mega:not([hidden])")
        ms = (time.perf_counter() - t0) * 1000
        cols = await page.locator(".mega-in > div").count()
        coltops = await page.eval_on_selector_all(".mega-in > div", "els => els.map(e => Math.round(e.getBoundingClientRect().top))")
        longest = max(await page.eval_on_selector_all(".mega-in > div", "els => els.map(e => e.querySelectorAll('li').length)"))
        viewall = await page.locator(".mega-in .viewall").count()
        check("Menu", "Hover opens the mega menu straight away", ms < 300, f"{ms:.0f} ms")
        check("Menu", "Three levels: department, column per group, product types below", cols >= 5 and len(set(coltops)) == 1, f"{cols} columns in one row")
        check("Menu", "Columns capped at 12 links, each with View all to the group page", longest <= 12 and viewall == cols, f"longest column {longest} links")
        check("Menu", "Menu tells screen readers it is open", await page.locator("a[data-dept=electrical][aria-expanded=true]").count() == 1)
        await page.screenshot(path=str(OUT / "ours-mega.png"), clip={"x": 0, "y": 110, "width": 1366, "height": 600})
        await page.mouse.move(683, 880)
        await page.wait_for_timeout(150)
        check("Menu", "Menu closes when the pointer leaves", await page.locator("#mega[hidden]").count() == 1)
        strip = await page.locator("#promise a").count()
        check("Header", "Promise strip: 3-4 short promises, each a link", 3 <= strip <= 4, f"{strip} links")
        box = await page.locator(".promise").bounding_box()
        await page.screenshot(path=str(OUT / "ours-promise.png"), clip={"x": 0, "y": box["y"], "width": 1366, "height": box["height"]})
        check("Header", "Offer bar: full width with one call to action", await page.locator("a.promo .cta").count() == 1)
        crumbs = await page.locator(".crumbs a").count()
        check("Breadcrumb", "Desktop: Home and every parent level as links, current page is the heading", crumbs == 3 and "UPVC" not in await page.locator(".crumbs").inner_text())
        await page.click(opt('Size (inch)~3/4"'))
        await page.wait_for_timeout(120)
        last = page.locator(".crumbs a").last
        check("Breadcrumb", "Once filtered, the category becomes the last crumb and links to the unfiltered list", await last.inner_text() == "UPVC Fittings" and await last.get_attribute("href") == TYPE)

        # ================= search =================
        await goto(page, "#/")
        inp = page.locator("#search-input")
        await inp.fill("up")
        await page.wait_for_timeout(100)
        closed2 = await page.locator("#suggest").is_hidden()
        await inp.fill("upv")
        await page.wait_for_timeout(150)
        open3 = await page.locator("#suggest").is_visible()
        check("Search", "Suggestions open from the 3rd character", closed2 and open3)
        await inp.fill("3x4 upvc elb")
        await page.wait_for_timeout(150)
        phrases = page.locator("#suggest [data-sg=phrase]")
        nph = await phrases.count()
        bolds = await page.locator("#suggest [data-sg=phrase] b").count()
        prods = page.locator("#suggest [data-sg=product]")
        npr = await prods.count()
        prod_ok = npr > 0 and all([await prods.nth(i).locator(".sg-img").count() == 1 and re.search(r"SA[0-9A-F]{6}", await prods.nth(i).inner_text()) and "₹" in await prods.nth(i).inner_text() for i in range(npr)])
        check("Search", "Up to 5 phrases with the typed part in bold", 1 <= nph <= 5 and bolds >= nph, f"{nph} phrases")
        check("Search", "Up to 3 product previews with picture, name, code and price", 1 <= npr <= 3 and prod_ok, f"{npr} products")
        await inp.fill("upvc tee")
        await page.wait_for_timeout(150)
        before = await inp.input_value()
        await inp.press("ArrowDown")
        copied = await inp.input_value()
        first_phrase = await phrases.first.get_attribute("data-text")
        await inp.press("Escape")
        await page.wait_for_timeout(80)
        check("Search", "Arrow keys move through phrases and copy them into the box; Esc closes and keeps the text",
              copied == first_phrase and await page.locator("#suggest").is_hidden() and await inp.input_value() == copied, f"'{before}' → '{copied}'")
        await inp.fill("upvc tee")
        await page.wait_for_timeout(120)
        await inp.press("ArrowDown")
        await inp.press("Enter")
        await page.wait_for_timeout(300)
        check("Search", "Enter on a highlighted phrase searches for it", "#/search?q=" in page.url and await page.locator(".grid .card").count() > 0, page.url.split("#")[1])
        await inp.fill("abc")
        await page.click("#search-clear")
        focused = await page.evaluate("document.activeElement.id")
        check("Search", "Clear (×) empties the box and keeps the cursor there", await inp.input_value() == "" and focused == "search-input")

        sets = {q: await all_search(page, q) for q in ["3x4 upvc", "3/4 upvc", "20mm upvc", "upvc 3x4"]}
        check("Search", "3x4, 3/4 and 20mm UPVC return the same items", len({frozenset(s) for s in sets.values()}) == 1 and sets["3x4 upvc"], ", ".join(f"{q}: {len(s)}" for q, s in sets.items()))
        sets = {q: await all_search(page, q) for q in ["8mm bolt", "8 mm bolt", "8-mm bolt", "M8 bolt"]}
        check("Search", "8mm, 8 mm, 8-mm and M8 return the same items", len({frozenset(s) for s in sets.values()}) == 1 and sets["8mm bolt"], ", ".join(f"{q}: {len(s)}" for q, s in sets.items()))
        sets = {q: await all_search(page, q) for q in ['½" gi', '1/2" gi', '0.5" gi']}
        check("Search", '½", 1/2" and 0.5" return the same items', len({frozenset(s) for s in sets.values()}) == 1 and sets['1/2" gi'], ", ".join(f"{q}: {len(s)}" for q, s in sets.items()))
        for q, want in [("11/2 pvc tee", '1 1/2"'), ("21/2 gi elbow", '2 1/2"')]:
            await goto(page, f"#/search?q={quote(q)}&pp=all")
            titles = await page.locator(".grid .card h3").all_inner_texts()
            check("Search", f"'{q}' finds {want} items", titles and all(want in t for t in titles[:5]), f"{len(titles)} found")
        await goto(page, "#/search?q=hamer")
        banner = await page.locator(".sizebanner").first.inner_text() if await page.locator(".sizebanner").count() else ""
        check("Search", "Corrects 1-2 letter typos and says what it searched for", "hammer" in banner.lower() and await count(page) > 0, banner[:60])
        await goto(page, "#/search?q=elbwo upvc")
        check("Search", "Swapped letters are corrected too (elbwo → elbow)", await count(page) > 0 and "elbow" in (await page.locator(".sizebanner").first.inner_text()).lower())
        await goto(page, "#/search?q=SA3E4C85")
        first = (await skus(page))[:1]
        check("Search", "Finds a product by its code", first == ["SA3E4C85"])
        await goto(page, "#/search?q=ashirvad")
        check("Search", "Finds products by brand", await count(page) >= 20, f"{await count(page)} items")

        # ================= filters =================
        await goto(page, TYPE)
        total = await count(page)
        first_facet = (await page.locator(".facet .fh").first.inner_text()).strip().upper()
        check("Filters", "Filters come from product attributes, size first", first_facet.startswith("SIZE"), first_facet)
        bad, tried = [], 0
        for slug in ["plumbing-upvc-fittings", "paint-interior-emulsions", "electrical-house-wires"]:
            await goto(page, f"#/c/{slug}")
            opts = await page.eval_on_selector_all(".facet:not(.closed) a.opt", "els => els.filter(e => e.offsetParent).map(e => [e.dataset.f, +e.querySelector('.c').textContent.replace(/\\D/g, '')])")
            for f, n in opts[:10]:
                await page.click(opt(f))
                await page.wait_for_timeout(50)
                tried += 1
                got = await count(page)
                if got != n:
                    bad.append(f"{slug} {f}: says {n}, shows {got}")
                await goto(page, f"#/c/{slug}")
        check("Filters", "Every option shows a count, and it equals the items shown when ticked", not bad, f"{tried} options tried" + ("; " + "; ".join(bad[:3]) if bad else ""))

        await goto(page, TYPE)
        a_n = int((await page.locator(opt('Size (inch)~3/4"') + " .c").inner_text()).strip("()"))
        b_n = int((await page.locator(opt('Size (inch)~1"') + " .c").inner_text()).strip("()"))
        brand_before = await page.eval_on_selector_all(".facet a.opt[data-f^='Brand~'] .c", "els => els.map(e => e.textContent)")
        await page.click(opt('Size (inch)~3/4"'))
        await page.wait_for_timeout(80)
        brand_after = await page.eval_on_selector_all(".facet a.opt[data-f^='Brand~'] .c", "els => els.map(e => e.textContent)")
        await page.click(opt('Size (inch)~1"'))
        await page.wait_for_timeout(80)
        both = await count(page)
        check("Filters", "Options in one group combine with OR", both == a_n + b_n, f"3/4\" {a_n} + 1\" {b_n} = {both}")
        check("Filters", "Counts in other groups update after a tick", brand_before != brand_after)
        bfac = page.locator(".facet[data-facet$='|Brand']")
        if "closed" in await bfac.get_attribute("class"):
            await bfac.locator(".fh").click()
        brand = await page.locator("a.opt[data-f^='Brand~']:not(.extra)").first.get_attribute("data-f")
        await page.click(opt(brand))
        await page.wait_for_timeout(80)
        three = await count(page)
        check("Filters", "Groups combine with AND", 0 < three <= both, f"{both} → {three}")
        zero = await page.eval_on_selector_all("a.opt[aria-checked=false] .c", "els => els.filter(e => e.textContent === '(0)').length")
        check("Filters", "Options that would give zero results are hidden", zero == 0)
        applied = await page.locator(".filters-head small").inner_text()
        check("Filters", "Header shows how many filters are applied", "3" in applied, applied)

        await goto(page, TYPE)
        sizes = await page.eval_on_selector_all(".facet[data-facet$='Size (inch)'] a.opt", "els => els.map(e => e.dataset.f.split('~')[1])")
        nums = await page.evaluate("s => s.map(v => Sizes.value(v))", sizes)
        check("Filters", "Sizes shown in one format and sorted by number", nums == sorted(nums) and all(re.fullmatch(r'[\d /]+"( x [\d /]+")?', s) for s in sizes), " · ".join(sizes[:7]))

        await page.evaluate("window.scrollTo(0, 400)")
        t0 = time.perf_counter()
        await page.click(opt('Size (inch)~3/4"'))
        await page.wait_for_function("document.querySelector('.intro h1').textContent.includes('3/4')")
        ms = (time.perf_counter() - t0) * 1000
        heading = await page.locator(".intro h1 .h-text").inner_text()
        title = await page.title()
        res_top = await page.evaluate("document.getElementById('results').getBoundingClientRect().top")
        check("Filters", "A tick updates results, count, heading and tab title within 1 second", ms < 1000 and heading.startswith('3/4"') and title.startswith('3/4"'), f"{ms:.0f} ms, heading '{heading}'")
        check("Filters", "After a tick the view is at the top of the results", -5 <= res_top <= 300, f"results top at {res_top:.0f}px")
        url = page.url
        await page.reload()
        await page.wait_for_selector(".grid")
        check("Filters", "Every filter, sort and page is in the URL: reloading keeps the view", await page.locator(".intro h1 .h-text").inner_text() == heading and page.url == url)
        await page.click(opt('Size (inch)~1"'))
        await page.wait_for_timeout(80)
        two_heading = await page.locator(".intro h1 .h-text").inner_text()
        check("Filters", "Heading goes back to the plain name when two values are ticked", two_heading.lower() == "upvc fittings", two_heading)
        await page.select_option("#sort-top", "price-asc")
        await page.wait_for_timeout(80)
        await page.locator(".pager a", has_text="2").first.click() if await page.locator(".pager a", has_text="2").count() else None
        await page.go_back()
        await page.wait_for_timeout(120)
        back1 = page.url
        await page.go_back()
        await page.wait_for_timeout(120)
        back2 = page.url
        check("Filters", "Back steps through each filter and sort change", "sort=price-asc" not in back2 and back1 != back2, f"{back1.split('?')[-1][:50]} → {back2.split('?')[-1][:50]}")

        await goto(page, TYPE + "?sort=price-desc&page=2")
        await page.click(opt('Size (inch)~3/4"'))
        await page.wait_for_timeout(80)
        await page.locator(".filters-head a").click()
        await page.wait_for_timeout(120)
        check("Filters", "Clear all removes filters and resets sort and page", page.url.endswith(TYPE) and await count(page) == total)

        await goto(page, "#/c/electrical-house-wires")
        bf = page.locator(".facet[data-facet$='|Brand']")
        vis = await bf.locator("a.opt").evaluate_all("els => els.filter(e => e.offsetParent).length")
        await bf.locator("[data-more]").click()
        vis2 = await bf.locator("a.opt").evaluate_all("els => els.filter(e => e.offsetParent).length")
        check("Filters", "Long groups show 6 options and a View all link that then disappears", vis == 6 and vis2 > 6 and await bf.locator("[data-more]").count() == 0, f"{vis} then {vis2}")
        fh = page.locator(".facet .fh").first
        await fh.click()
        closed = await page.locator(".facet").first.get_attribute("class")
        exp = await fh.get_attribute("aria-expanded")
        await fh.click()
        check("Filters", "Each group collapses and expands from its header with +/−, and says so to screen readers", "closed" in closed and exp == "false")

        await goto(page, TYPE)
        tile = page.locator(".sb-tile").first
        tile_href = await tile.get_attribute("href")
        tile_label = await tile.locator("b").inner_text()
        await tile.click()
        await page.wait_for_timeout(100)
        ticked = await page.locator("a.opt[aria-checked=true]").first.get_attribute("data-f")
        check("Filters", "Shop by tiles apply the same filter as the tick box", tile_label in ticked and await page.locator(".sb-tile").count() == 0, f"tile {tile_label} → {ticked}")

        await goto(page, TYPE + "?pp=all")
        pf = page.locator(".facet[data-facet$='|Price']")
        if "closed" in (await pf.get_attribute("class")):
            await pf.locator(".fh").click()
        bands = await pf.locator("a.opt").count()
        await pf.locator("#pmin").fill("50")
        await pf.locator("#pmax").fill("200")
        await pf.locator(".btn-go").click()
        await page.wait_for_timeout(120)
        ps = await prices(page)
        check("Filters", "Price has rupee bands and a custom min-max", bands >= 2 and ps and all(50 <= x <= 200 for x in ps), f"{bands} bands, {len(ps)} items in ₹50-200")
        side = await page.locator(".side").bounding_box()
        await page.screenshot(path=str(OUT / "ours-filters.png"), clip={"x": side["x"], "y": side["y"] + 160, "width": side["width"], "height": 900}, full_page=True)

        # ================= sorting and paging =================
        res = []
        for key, fn in [("price-asc", lambda a: a == sorted(a)), ("price-desc", lambda a: a == sorted(a, reverse=True))]:
            await goto(page, f"{TYPE}?pp=all&sort={key}&f={quote('Size (inch)~3/4\"')}")
            ps = [x for x in await prices(page) if x is not None]
            kept = await page.locator("a.opt[aria-checked=true]").count() == 1
            res.append((key, fn(ps) and kept))
        for key, rev in [("brand-az", False), ("brand-za", True)]:
            await goto(page, f"{TYPE}?pp=all&sort={key}")
            brands = await page.evaluate("[...document.querySelectorAll('.grid .card')].map(c => SHOP.ITEMS.find(i => i.sku === c.dataset.sku).b)")
            res.append((key, brands == sorted(brands, key=str, reverse=rev)))
        check("Sort", "Sort by price and brand works and keeps the filters", all(ok for _, ok in res), ", ".join(f"{k} {'ok' if ok else 'WRONG'}" for k, ok in res))
        await goto(page, TYPE)
        await page.select_option("#sort-bottom", "price-desc")
        await page.wait_for_timeout(100)
        check("Sort", "Sort boxes above and below the grid stay in sync", await page.locator("#sort-top").input_value() == "price-desc")
        await goto(page, TYPE)
        c1 = await page.locator(".grid .card").count()
        pagers = await page.locator(".pager").count()
        nums_ok = await page.locator(".pager").first.locator("a", has_text="2").count() == 1 and await page.locator(".pager [rel=next]").count() == 2
        await page.locator(".perpage a", has_text="All").first.click()
        await page.wait_for_timeout(150)
        call = await page.locator(".grid .card").count()
        check("Paging", "24 per page, page numbers with Previous / Next above and below the grid", c1 == 24 and pagers == 2 and nums_ok, f"{c1} cards, {pagers} pagers")
        check("Paging", "Show all lists up to 100 and hides the pager", call == min(total, 100) and await page.locator(".pager").count() == 0, f"{call} of {total}")
        bar = await page.locator(".results-bar").first.bounding_box()
        await page.screenshot(path=str(OUT / "ours-perpage.png"), clip={"x": bar["x"] + bar["width"] - 420, "y": bar["y"], "width": 420, "height": bar["height"]})
        await goto(page, "#/c/electrical-aluminium-wire")
        check("Paging", "Paging controls hidden when there is only one page", await page.locator(".pager").count() == 0 and await page.locator(".perpage").count() == 0, f"{await count(page)} items")
        await goto(page, TYPE)
        ctops = await page.eval_on_selector_all(".grid .card", "els => els.slice(0, 2).map(e => Math.round(e.getBoundingClientRect().top))")
        check("Paging", "Product grid is 2 columns on desktop, SEO text below", len(ctops) == 2 and ctops[0] == ctops[1] and await page.locator(".seo p").count() == 1)

        # scroll restore when returning from a product
        await goto(page, TYPE)
        await page.evaluate("window.scrollTo(0, 1500)")
        await page.wait_for_timeout(100)
        y0 = await page.evaluate("scrollY")
        card = page.locator(".grid .card").nth(6)
        await card.locator("h3 a").click()
        await page.wait_for_selector(".pdp")
        await page.go_back()
        await page.wait_for_selector(".grid")
        await page.wait_for_timeout(250)
        y1 = await page.evaluate("scrollY")
        check("Paging", "Back from a product returns to the same scroll position", abs(y1 - y0) < 40, f"{y0} → {y1}")

        # ================= product card =================
        await goto(page, TYPE)
        card = page.locator(".grid .card").first
        title = await card.locator("h3").inner_text()
        parts = {
            "image": await card.locator(".img").count() == 1,
            "name+code": re.search(r"\(SA[0-9A-F]{6}", title) is not None,
            "stars": await card.locator(".stars").count() == 1,
            "≤3 points": 1 <= await card.locator(".feats li").count() <= 3,
            "GST label": "inc GST" in await card.locator(".tax").inner_text(),
            "stock": await card.locator(".stock, .stk").count() == 1,
            "collect ready time": "Ready in" in await card.locator(".svc").inner_text(),
            "add": await card.locator("[data-add]").count() == 1,
        }
        check("Product card", "Card shows image, name, code, stars, key points, price with GST, stock and ready time", all(parts.values()), ", ".join(k for k, v in parts.items() if not v) or "all present")
        offer = page.locator(".grid .card .price-row.offer").first
        check("Product card", "Offers show a −% flag, a red price and the MRP struck through", await offer.locator(".flag").count() == 1 and await offer.locator("s").count() == 1)
        q = card.locator(".qty-in")
        await q.fill("")
        await q.type("a1b2")
        typed = await q.input_value()
        await q.fill("12345")
        maxed = await q.input_value()
        await q.fill("0")
        await q.dispatch_event("change")
        zero_fix = await q.input_value()
        msg = await page.locator("#toast").inner_text()
        await card.locator("[data-step='-1']").click()
        after_minus = await q.input_value()
        await card.locator("[data-step='1']").click()
        check("Product card", "Quantity takes digits only (up to 4), defaults to 1, has − and +, refuses 0 with a message",
              typed == "12" and len(maxed) == 4 and zero_fix == "1" and "1" in msg and after_minus == "1" and await q.input_value() == "2", f"typed a1b2 → {typed}; 0 → {zero_fix} ({msg[:30]})")
        check("Product card", "Collect is pre-selected", await card.locator(".fulfil input[value=collect]").is_checked())
        bw = (await card.locator("[data-add]").bounding_box())["width"]
        cw = (await card.bounding_box())["width"]
        n0 = int(await page.locator(".header .basket-count").inner_text())
        await card.locator("[data-add]").click()
        check("Product card", "Full-width Add to basket adds the item", bw > cw * 0.85 and int(await page.locator(".header .basket-count").inner_text()) == n0 + 1)

        # PIN code
        await card.locator("[data-pin]").first.click()
        await page.fill("#pin-form input", "620001")
        await page.click("#pin-form button.btn-primary")
        await page.wait_for_timeout(150)
        pin_card = "620001" in await page.locator(".grid .card .svc").first.inner_text()
        await goto(page, "#/c/plumbing-pvc-fittings")
        pin_kept = "620001" in await page.locator(".grid .card .svc").first.inner_text()
        check("Delivery", "Asks for the PIN code once, remembers it and shows delivery on every card", pin_card and pin_kept)

        # compare
        await goto(page, TYPE)
        boxes = page.locator(".grid .card [data-compare]")
        for i in range(2):
            await boxes.nth(i).check()
        counter = await page.locator(".grid .card .cmp-n").first.inner_text()
        btns = await page.locator(".grid .card .cmp-go:not([hidden])").count()
        for i in range(2, 5):
            await boxes.nth(i).click()
        ticked = await page.locator(".grid .card [data-compare]:checked").count()
        await goto(page, "#/c/plumbing-pvc-fittings")
        await goto(page, TYPE)
        kept = await page.locator(".grid .card [data-compare]:checked").count()
        check("Compare", "Compare up to 4 with an n/4 counter; a Compare button shows once 2 are ticked; ticks survive browsing",
              counter == "(2/4)" and btns == 2 and ticked == 4 and kept == 4, f"counter {counter}, ticked {ticked}, kept {kept}")
        await page.locator(".compare-tray a", has_text="Compare now").click()
        await page.wait_for_selector(".cmp-table")
        cols = await page.locator(".cmp-table thead th").count() - 1
        await page.check("#cmp-diff")
        hl = await page.locator(".cmp-table.hl tr.diff").count()
        await page.locator("[data-cmp-rm]").first.click()
        after = await page.locator("[data-cmp-rm]").count()
        check("Compare", "Compare page with 4 slots, Highlight differences, and remove (×)", cols == 4 and hl > 0 and after == 3, f"{hl} rows differ")
        await page.locator("[data-cmp-clear-return]").click()
        await page.wait_for_timeout(150)

        # ================= product page =================
        await goto(page, "#/p/SA3E4C85")
        await page.click("[data-zoom]")
        viewer = await page.locator(".overlay .viewer").count() == 1
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(100)
        check("Product page", "Gallery with thumbnails and a zoom viewer that closes on Esc", viewer and await page.locator("#overlay").is_hidden() and await page.locator(".gallery .thumbs button").count() >= 1)
        await page.click("[data-tab-link=reviews]")
        check("Product page", "Review count link opens the Reviews tab", await page.locator("#panel-reviews").is_visible())
        await page.click("[data-tab=questions]")
        check("Product page", "Reviews / Questions / Specifications tabs switch in place", await page.locator("#panel-questions").is_visible() and await page.locator("#panel-reviews").is_hidden())
        await page.click("[data-tab=specs]")
        specs = await page.locator("#panel-specs th").all_inner_texts()
        listing_filters = await page.evaluate("SHOP.ITEMS.find(i => i.sku === 'SA3E4C85').type.filters")
        attrs = await page.evaluate("Object.keys(SHOP.ITEMS.find(i => i.sku === 'SA3E4C85').a)")
        shared = [a for a in attrs if a in listing_filters]
        check("Product page", "Specifications list the same attributes the listing filters use", shared and all(a in specs for a in shared), ", ".join(shared))
        check("Product page", "Name, code, description, key points, buy box and related products", await page.locator(".details h1 .code").count() == 1 and await page.locator(".details .feats li").count() >= 3 and await page.locator(".buybox [data-add]").count() == 1 and await page.locator(".carousel .card").count() >= 3)
        await page.click(".details .viewall")
        await page.wait_for_selector(".grid")
        ticked = await page.locator("a.opt[aria-checked=true]").first.get_attribute("data-f")
        check("Product page", "View all brand link opens the list with that brand ticked", ticked and ticked.startswith("Brand~"), ticked)
        await goto(page, "#/p/SA3E4C85")
        await page.click(".details [data-ask]")
        ok = await page.locator(".overlay textarea[maxlength='255']").count() == 1
        await page.click(".overlay [data-close]")
        check("Product page", "Ask a question opens a form; Cancel closes it", ok and await page.locator("#overlay").is_hidden())

        # ================= department page =================
        await goto(page, "#/d/plumbing")
        rows = await page.eval_on_selector_all(".gtile", "els => els.slice(0, 3).map(e => Math.round(e.getBoundingClientRect().top))")
        check("Department page", "Group tiles 3 per row, sidebar intro with Read more, sub-category links", len(set(rows)) == 1 and len(rows) == 3 and await page.locator(".side [data-readmore]").count() == 1 and await page.locator(".side .subcats a").count() >= 5)
        await page.click(".carousel [data-car='1']")
        await page.wait_for_timeout(500)
        moved = await page.evaluate("document.querySelector('.car-track').scrollLeft")
        check("Department page", "Best value carousel slides with its arrows", moved > 0, f"moved {moved}px")

        # ================= GST, quick order, basket, language =================
        await goto(page, TYPE)
        inc = await prices(page)
        await page.click("#gst-toggle")
        await page.wait_for_timeout(150)
        ex = await prices(page)
        ok = all(a is None or abs(b - round(a / 1.18, 2)) < 0.02 for a, b in zip(inc, ex))
        await goto(page, "#/c/plumbing-pvc-fittings")
        remembered = "ex GST" in await page.locator(".grid .card .tax").first.inner_text()
        check("GST", "GST switch changes every price and label, and is remembered on later pages", ok and remembered, f"{inc[0]} → {ex[0]}")
        await page.click("#gst-toggle")

        await goto(page, "#/quick-order?mat=UPVC&size=3/4in")
        rows = await page.locator(".qo-table tbody tr").count()
        ins = page.locator("[data-qo]")
        await ins.nth(0).fill("10")
        await ins.nth(1).fill("5")
        lines = await page.locator("#qo-lines").inner_text()
        await page.click("#qo-add")
        check("Quick order", "UPVC + 3/4\" lists every matching item; typed quantities go to the basket in one go", rows > 10 and lines == "2", f"{rows} items")
        await page.screenshot(path=str(OUT / "ours-quickorder.png"))
        await goto(page, "#/basket")
        check("Basket", "Basket lists items with a checkout form and PIN code", await page.locator(".bl-row").count() >= 2 and await page.locator("#co-pin").input_value() == "620001")
        await page.click("#lang-btn")
        await page.wait_for_timeout(150)
        tam = await page.locator(".nav-list a").first.inner_text()
        check("Language", "Tamil switch changes the menu", re.search(r"[஀-௿]", tam) is not None, tam)
        await page.click("#lang-btn")

        # ================= quality =================
        await goto(page, TYPE)
        links = await page.evaluate("""() => {
          const opts = [...document.querySelectorAll('.facet a.opt')].every(a => a.getAttribute('href').startsWith('#/'));
          const prods = [...document.querySelectorAll('.grid .card h3 a')].every(a => a.getAttribute('href').startsWith('#/p/'));
          const cats = [...document.querySelectorAll('.nav-list a, .crumbs a')].every(a => a.getAttribute('href').startsWith('#'));
          return opts && prods && cats; }""")
        check("Quality", "Every category, product and filter option is a real link (opens in a new tab)", links)
        t0 = time.perf_counter()
        await page.goto(URL + TYPE)
        await page.wait_for_selector(".grid .card")
        ms = (time.perf_counter() - t0) * 1000
        check("Quality", "Listing's first screen appears quickly (local server; phone on 4G not measured)", ms < 2500, f"{ms:.0f} ms")

        # ================= phone =================
        m = await browser.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        m.on("pageerror", lambda e: errors.append(str(e)))
        await m.goto(URL + TYPE)
        await m.wait_for_selector(".listing")
        wide = await m.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
        check("Phone", "Works at phone width without sideways scrolling", not wide)
        await m.evaluate("window.scrollTo(0, 1200)")
        await m.wait_for_timeout(100)
        bar_top = await m.evaluate("document.getElementById('phonebar').getBoundingClientRect().top")
        labels = [x.strip() for x in await m.locator("#phonebar span").all_inner_texts()]
        check("Phone", "Browse, Search, Shop and Basket bar stays pinned to the top", abs(bar_top) < 2 and labels == ["Browse", "Search", "Shop", "Basket"], f"bar at {bar_top}px")
        check("Phone", "Breadcrumb becomes one Back to parent link", await m.locator(".crumbs-back a").is_visible() and await m.locator(".crumbs").is_hidden())
        await m.click("[data-pb=browse]")
        lvl1 = await m.locator("#phone-panel .pp-row").count()
        await m.locator("#phone-panel .pp-row", has_text="Plumbing").click()
        lvl2 = await m.locator("#phone-panel .pp-back").inner_text(), await m.locator("#phone-panel .pp-all").inner_text()
        await m.locator("#phone-panel button.pp-row").first.click()
        lvl3 = await m.locator("#phone-panel .pp-back").inner_text(), await m.locator("#phone-panel .pp-all").inner_text()
        await m.locator("#phone-panel a.pp-row:not(.pp-all)").first.click()
        await m.wait_for_selector(".listing")
        check("Phone", "Browse drills down one level at a time with Back and ALL rows", lvl1 == 9 and "Back" in lvl2[0] and lvl2[1].startswith("ALL") and "Plumbing" in lvl3[0] and lvl3[1].startswith("ALL") and await m.locator("#phone-panel").is_hidden(), f"{lvl1} departments; {lvl2[0]} / {lvl3[0]}")
        await m.click("[data-pb=search]")
        await m.wait_for_timeout(100)
        focused = await m.evaluate("document.activeElement.id")
        await m.locator("#search-input").type("upvc elb")
        await m.wait_for_timeout(200)
        check("Phone", "Search opens below the bar, focused, with product previews too", focused == "search-input" and await m.locator("#suggest [data-sg=product]").count() >= 2)
        await m.keyboard.press("Escape")
        await m.goto(URL + TYPE)
        await m.wait_for_selector(".listing")
        await m.click(".mob-bar [data-drawer]")
        drawer = await m.locator(".side.drawer").is_visible()
        locked = await m.evaluate("document.body.classList.contains('noscroll')")
        close_txt = await m.locator(".drawer-apply button").inner_text()
        await m.locator(".side.drawer .facet .fh").first.click()
        solo = await m.locator(".facet.solo .solo-bar").is_visible()
        await m.locator(".facet.solo a.opt").nth(1).click()
        await m.wait_for_timeout(150)
        still = await m.locator(".facet.solo a.opt[aria-checked=true]").count() == 1
        behind = await count(m)
        await m.locator(".facet.solo .solo-bar .btn").click()
        chosen = await m.locator(".side.drawer .facet .chosen").first.inner_text()
        apply_txt = await m.locator(".drawer-apply button").inner_text()
        await m.click(".drawer-apply button")
        closed = await m.locator(".side.drawer").count() == 0
        check("Phone", "Filter (n) opens a full-screen panel listing the groups; the page behind does not scroll", drawer and locked and close_txt == "Close")
        check("Phone", "Each group opens its own list with Back and Done; ticks apply at once", solo and still and behind < 83, f"{behind} results behind the panel")
        check("Phone", "Chosen values show under the group name; the button turns into Apply and closes the panel", chosen and apply_txt.startswith("Apply") and closed, f"'{chosen}', '{apply_txt}'")

        check("Quality", "No script errors on any page", not errors, "; ".join(errors[:3]))
        await browser.close()

    (OUT / "results.json").write_text(json.dumps(RESULTS, indent=1, ensure_ascii=False))
    failed = [r for r in RESULTS if not r["pass"]]
    print(f"\n{len(RESULTS) - len(failed)}/{len(RESULTS)} checks pass")
    sys.exit(1 if failed else 0)


asyncio.run(main())
