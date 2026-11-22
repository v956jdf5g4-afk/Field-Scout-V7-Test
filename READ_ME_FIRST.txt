Field Scout v7.2 — Reliability Candidate (TEST BUILD)

Built from the exact v7.1.1 Recipes Fix ZIP provided by the user.

Deploy: Extract this ZIP, then upload its contents (index.html, sw.js, manifest.webmanifest) to the V7 TEST GitHub repository. Do not touch the old v6.3 app.

WHAT CHANGED
- Cloud sync now includes individual app settings, including plans, annual field data, spray recipes, products, assignments, and spray orders, using the existing Supabase revision-checked save function.
- Divergent setting data is preserved for review rather than silently overwritten. Resolve conflicts in Settings, after downloading a full-device backup.
- A daily cloud snapshot of notes and application settings is written to the existing Supabase sync table after a conflict-free sync. This snapshot is NOT independent of Supabase and has no one-click restore yet.
- Existing daily local snapshots, full-device JSON export, and scouting CSV export remain available.

IMPORTANT LIMITATIONS
- This is not a field-ready release yet. No end-to-end browser, PC/iPad cross-device, or restore test was performed in this build environment.
- Cloud snapshots are in the SAME Supabase project as live synced records, not a separate cloud backup. Download the full-device JSON regularly and store it outside Supabase.
- The local daily recovery snapshot mechanism does not yet have a tested full-device restore procedure.
- Existing Test Center checks are local diagnostics, not proof of successful cloud recovery.
- After syncing new plan/recipe data from another device, reload the page to refresh the screen.

MINIMUM ACCEPTANCE TEST
1. On PC, save a TEST plan and a TEST recipe; click Sync in Settings.
2. On iPad, sign in, sync, reload, and verify both appear.
3. On iPad, go offline, change a test recipe or plan, reconnect, sync, then verify PC receives it.
4. Export a full-device backup and verify it appears in Downloads.
5. Confirm Settings sync status reports a daily cloud snapshot; no conflict warnings.
Do not use for sole-copy production records until recovery is tested.
