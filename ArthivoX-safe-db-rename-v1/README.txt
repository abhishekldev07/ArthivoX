ArthivoX Safe Company Database Rename v1
========================================

Purpose
-------
When a company is renamed in ArthivoX Cloud, keep the physical local SQLite
filename and every stored path aligned with the new company name.

Example:
  Visible company:
    Northstar Apparel Co.

  Before:
    C:\...\ArthivoX\Flo's Clothes.books.db

  After:
    C:\...\ArthivoX\Northstar Apparel Co.books.db

What the patch changes
----------------------
1. Adds an Electron IPC action dedicated to safe .books.db renaming.
2. Closes any stale database connection before the Windows file move.
3. Sanitizes the company name for Windows filenames.
4. Refuses to overwrite an existing database.
5. Updates the app's Recent Companies config entry.
6. Updates lastSelectedFilePath when necessary.
7. Updates ArthivoX Cloud's local company-path map in App.vue.
8. Lets the company editor repair an existing filename mismatch even when the
   visible company name is already correct.
9. Replaces the full technical path in Recent Companies with:
      Local company database

No Supabase migration is required.

Apply
-----
Extract into ArthivoX-production-ready and run:

node .\ArthivoX-safe-db-rename-v1\add-safe-db-rename.mjs
yarn typecheck

If typecheck passes:

Get-Process ArthivoX,electron -ErrorAction SilentlyContinue | Stop-Process -Force
Remove-Item .\dist_electron -Recurse -Force -ErrorAction SilentlyContinue
yarn build:source
yarn build:win:unsigned

Fix the existing Northstar filename
-----------------------------------
After launching the fresh build:

1. Go to ArthivoX Cloud.
2. Click Edit on Northstar Apparel Co.
3. Do NOT change the name.
4. "Save changes" will still be enabled because the local filename is stale.
5. Click Save changes.

Expected local file:
  Northstar Apparel Co.books.db

Expected Recent Companies subtitle:
  Local company database

The cloud company UUID, sync records, encrypted backups, accounting records,
and membership are not recreated or replaced.
