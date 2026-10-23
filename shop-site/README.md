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

One click: double-click **Update website.command** (Mac).

Keep these in a `my-data` folder next to it (the folder is never uploaded to GitHub):

| File | What it is |
| --- | --- |
| `website_items.xlsx` | Your website item list. This is the master for the website. |
| `item.xlsx` | Optional. A fresh item export from Busy. Brings in new items and new prices. |
| `database.txt` | Optional. The Supabase connection string, once the live site exists. |

What you can change in `website_items.xlsx`:

- **All Items → Show on website**: set an item to *No* to hide it. *Yes* brings it back.
- **Website Settings**: switch a whole department or brand off (*No*). You can also choose whether new items from Busy show straight away, and whether items no longer in Busy are hidden.
- Prices, names, categories (Department / Group / Product Type) and filter values can be edited directly.

What the click does:

1. With `item.xlsx`: updates prices, MRP and units, sorts new items into categories (marked *new* in the Check column, listed on the Needs Review sheet) and notes items that are no longer in Busy.
2. Saves the item list (the old copy goes to `my-data/backups`).
3. Rebuilds the website from the items that should show.
4. With `database.txt`: updates Supabase. Orders, stock, photos and descriptions are kept. Hidden items are switched off, never deleted.
5. Opens the website on your computer to check, and writes `my-data/update-report.txt`.

The first run takes a minute longer while it sets itself up. Without the double-click:
`python3 tools/update_website.py my-data/website_items.xlsx --busy my-data/item.xlsx --db my-data/database.txt`

## Tests

```sh
node tools/test_sizes.mjs
python3 -m http.server 8765 -d site &
pip install playwright
python3 tools/test_site.py http://localhost:8765/ /tmp/site-results
```
