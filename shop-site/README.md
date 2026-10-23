# Senthil Andavar Hardwares website

A shop website built the way the big UK trade sites work (department menu, filter panel, size-first
filters, product cards, results per page, quick order), with the shop's own name, colours and items.
Prices in rupees, inc/ex GST switch, English and Tamil, WhatsApp ordering.

Nothing here costs money or goes live by itself.

## What is in this folder

| Folder | What it is |
| --- | --- |
| `site/` | The website. Plain HTML, CSS and JavaScript, no build step. |
| `site/js/config.js` | Shop name, phone, WhatsApp number, address, hours, promise strip, Supabase keys. **Edit this file to change shop details.** |
| `db/schema.sql` | The database design for Supabase (Postgres): menu, products, orders, size search. |
| `tools/build_catalog.py` | Turns the item spreadsheet into `site/data/catalog.json` and `site/data/seed.sql`. |
| `tools/test_site.py` | Browser tests: clicks through the menu, filters, sort, GST switch, search, quick order, phone layout. |
| `tools/test_sizes.mjs` | Tests for the size notation reader (3x4, 11/2, 20mm...). |

`site/data/` is not in git because it holds the shop's prices and this repository is public.
Make it from the spreadsheet (step 1 below).

## Run it on a computer

```sh
pip install pandas openpyxl
python3 tools/build_catalog.py screwfix_style_categories_2026-10-23.xlsx site/data   # 1. make the item data
python3 -m http.server 8765 -d site                                                    # 2. start a small web server
# 3. open http://localhost:8765 in a browser
```

## Size search

Customers type sizes the way they say them at the counter:

| Typed | Means |
| --- | --- |
| `3x4`, `3/4`, `3/4"` | 3/4 inch |
| `11/2`, `1 1/2`, `1.5"` | 1 1/2 inch (`21/2` = 2 1/2, `11/4` = 1 1/4) |
| `4x2`, `4*2` | 4 inch to 2 inch (reducers) |
| `20mm`, `20 mm` | 20 mm, and the inch size it equals for that pipe type |
| `2.5 sq mm` | wire size (not a pipe size) |

Pipe mm sizes depend on the pipe type, so each item carries both spellings:
UPVC/CPVC 3/4" = 20 mm, PVC 3/4" = 25 mm, GI/metal 3/4" = 20 mm (nominal bore).
The same rules are in `site/js/sizes.js` (browser) and `size_tokens()` in `db/schema.sql` (database).

## Going live (later, needs Chandru's go-ahead)

1. Create a Supabase project (free tier to start).
2. In its SQL editor, run `db/schema.sql`, then `site/data/seed.sql`.
3. Put the project URL and the public "anon" key in `site/js/config.js`. The site then reads items from
   Supabase and orders are saved in the `orders` table (customers cannot read other people's orders).
4. Put the `site/` folder on a static host (Netlify, Cloudflare Pages or Vercel).
5. Fill in phone, WhatsApp number and address in `config.js`.

## Updating items and prices

Change the spreadsheet, run step 1 again, and (once on Supabase) run the new `seed.sql`.
Items marked "needs review" in the spreadsheet still show; their category may be fixed later.

## Tests

```sh
node tools/test_sizes.mjs
python3 -m http.server 8765 -d site &
pip install playwright
python3 tools/test_site.py http://localhost:8765/ /tmp/site-results
```
