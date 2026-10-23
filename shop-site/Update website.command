#!/bin/bash
# Double-click this file to update the website from your item list.
#
# Put these in the my-data folder next to this file:
#   website_items.xlsx   your website item list (Show on website column, Website Settings sheet)
#   item.xlsx            optional: a fresh item export from Busy, for new items and new prices.
#                        If it is not here, the shop's item master ../raw:/claude/item.xlsx is used (read only).
#   database.txt         optional: the Supabase connection string, once the live site exists
cd "$(dirname "$0")" || exit 1
DATA="my-data"
VENV="$HOME/.shop-website-python"

say() { printf "\n%s\n" "$*"; }
finish() { printf "\nPress Enter to close this window."; read -r _; exit "${1:-0}"; }

if [ ! -f "$DATA/website_items.xlsx" ]; then
  say "I can't find $DATA/website_items.xlsx. Put your website item list in the my-data folder and try again."
  finish 1
fi
if ! command -v python3 >/dev/null 2>&1; then
  say "Python is not installed. A window may ask to install the Apple developer tools: click Install, then double-click this file again."
  xcode-select --install 2>/dev/null
  finish 1
fi
if [ ! -x "$VENV/bin/python" ]; then
  say "First run: setting up (takes a minute, only once)..."
  python3 -m venv "$VENV" && "$VENV/bin/pip" install -q --upgrade pip && "$VENV/bin/pip" install -q pandas openpyxl "psycopg[binary]" || { say "Setup failed. Check the internet connection and try again."; finish 1; }
fi

ARGS=("$DATA/website_items.xlsx")
if [ -f "$DATA/item.xlsx" ]; then ARGS+=(--busy "$DATA/item.xlsx")
elif [ -f "../raw:/claude/item.xlsx" ]; then ARGS+=(--busy "../raw:/claude/item.xlsx"); fi
[ -f "$DATA/database.txt" ] && ARGS+=(--db "$DATA/database.txt")

say "Updating the website..."
if ! "$VENV/bin/python" tools/update_website.py "${ARGS[@]}"; then
  say "Something went wrong (see above). Your item list was not changed; a backup is in my-data/backups."
  finish 1
fi

say "Opening the website on this computer to check..."
(cd site && "$VENV/bin/python" -m http.server 8765 >/dev/null 2>&1 &) 
sleep 1
open "http://localhost:8765/"
say "Done. The report is saved in my-data/update-report.txt."
printf "\nPress Enter to close (this also closes the preview)."; read -r _
pkill -f "http.server 8765" 2>/dev/null
