# Field Scout V7.3.0 — User acceptance checklist

Use only the V7 Test app. Existing test records can stay until a coordinated cleanup of local AND cloud storage.

## Fields and crop-year integrity

- [ ] Verify header displays V7.3.0.
- [ ] Set crop year to 2027. A field never explicitly configured for 2027 should say **Unconfirmed**, not claim the original 2026 crop.
- [ ] Open **Planning → Review crop-year field information**. Check the confirmed/unconfirmed totals.
- [ ] Select **FW15 — Peterson**, confirm its **2027** crop as **Spring wheat** (160 acres if correct). Check that it remains correct after reloading.
- [ ] Switch to **2026**. FW15 should retain the earlier 2026 crop. Do not make assumptions about other years without verifying them.
- [ ] Change a test field's name or farmer effective in 2027, then check that its 2026 identity is unchanged.
- [ ] While typing an unsaved scouting note, try changing crop year. The app should warn you first.

## Scouting notes and next visits

- [ ] Save a test observation in 2026 with a next visit in five days.
- [ ] Save a newer test observation in the same field with **No follow-up**.
- [ ] The older five-day visit must not continue showing as Due/Upcoming.
- [ ] Switch to 2027, open the field; the two 2026 observations should still show under **All years**.
- [ ] Switch history filter to **Current year only**; older records should be filtered out.
- [ ] Reload online, then temporarily go offline and make sure a test observation still saves locally.

## Sync / backups

- [ ] Sign in and verify a meaningful **Up to date** sync status before switching devices.
- [ ] While offline on device A, save a test note. Reconnect and verify it uploads.
- [ ] On device B, verify the note downloads and displays for the same field.
- [ ] On device A, change a field's 2027 crop. After both devices sync, verify device B uses that crop without a manual reload.
- [ ] Download a full-device JSON backup. Verify that the file actually appears in Downloads.
- [ ] Do not perform an actual restore unless intentionally testing recovery with a safe, isolated device.

## Spray orders

- [ ] Confirm unconfirmed crop-year fields cannot silently produce spray-order acreage.
- [ ] Create a simple recipe in a confirmed test field; verify quantity calculations against a hand calculation.
- [ ] Verify a saved order retains original acres and recipe information after a later field change.

## Known areas requiring separate tests

- Supabase authorization/RLS and deliberate simultaneous-edit conflict resolution.
- Clean installation on iPad and computer; service-worker offline reload and version upgrade.
- Full backup/restore from a safe, isolated environment.
- Removing all test data from both local devices and the cloud without repopulation.