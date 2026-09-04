ArthivoX Company Editor v1
==========================

Adds a professional company-name editor to the ArthivoX Cloud workspace.

WHAT IT ADDS
------------
- Edit button on every company card.
- Company profile modal.
- Editable company/workspace name (2-80 chars).
- Currency and country shown as locked/reference fields.
- Supabase companies.name update through the existing authenticated REST API.
- After opening a linked local workspace, the cloud company name is persisted
  into local AccountingSettings.companyName.
- The physical .books.db filename is intentionally NOT renamed.
- Existing company UUID, sync records, backups, devices and cloud membership
  remain unchanged.

BACKEND
-------
No Supabase migration is required. The existing companies UPDATE RLS policy
already allows company owners to update their company row.

APPLY
-----
Extract this folder into:
C:\Users\Lenovo\OneDrive\Desktop\Projects\ArthivoX-production-ready

Then run:

node .\ArthivoX-company-editor-v1\add-company-editor.mjs
yarn typecheck

If typecheck passes, rebuild when ready:

Get-Process ArthivoX,electron -ErrorAction SilentlyContinue | Stop-Process -Force
Remove-Item .\dist_electron -Recurse -Force -ErrorAction SilentlyContinue
yarn build:source
yarn build:win:unsigned

TEST
----
1. Open ArthivoX Cloud.
2. Click the small edit icon on Flo's Clothes.
3. Rename it to a temporary test name.
4. Confirm the Cloud Workspace card updates.
5. Open the workspace.
6. Confirm the sidebar/titlebar/report company name uses the new name.
7. Return to Cloud Workspace and rename it back if desired.

The local database filename should remain unchanged throughout.
