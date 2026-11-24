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
## V7.4.0-dev Field Plan review

Run `node tests/field-plan-check.cjs` with Node 18 or later. The checks use synthetic records and a simulated service-worker cache.

- [x] Node check. Two updates from the same prior entry retain both branches. A correction can supersede both, and another field in the original batch retains its own history.
- [x] Node check. An 80-acre synthetic order combines liquid and weight rates per acre and per 100 gallons. Expected 13.25 gal in 6 containers of 2.5 gal and 50.6 lb in 3 packages of 25 lb. An unconfirmed 20-acre field is excluded. Computed recipe and acres survive later edits to their inputs.
- [x] Simulated cache check. Planner script is precached, navigation falls back to cached HTML offline, and cleanup leaves other installation scopes alone.
- [ ] In an isolated test browser, open Planning and save one herbicide program for two confirmed fields. Revise only one field. Confirm first and latest entries, and confirm the second field retains its original program.
- [ ] Leave one 2027 field unconfirmed and confirm another. Verify only the latter is selectable. Record a farmer-reported 2026 fall work date against a 2027 plan. Compare both years.
- [ ] Reopen after disconnecting on desktop and iPad. Save a strip-till or broadcast update offline. Reconnect to a verified test account and confirm it syncs to the other device.
- [ ] Make overlapping updates to the same operation on both devices while offline. Sync, review both entries, save a correction and verify it appears on both devices.
- [ ] Export full-device JSON. Verify the plan batches are present and restore offline in an isolated browser. Verify plan, field year, recipe link, and original history. Verify older backup compatibility.
- [ ] Verify settings pagination across more than one server page and validate row-level policies and save-RPC authorization for signed-out, owner, and non-owner accounts with synthetic data.
- [ ] Verify clean install and upgrade from V7.3.0. Check cached data and unsynced records. Confirm the old backup commands are hidden and CSV/full-device backup still work.
- [ ] Check per-field spray quantities and printed saved order after source edits. Current report presentation groups line totals by recipe, rounds displayed quantities to three decimal places and uses the first encountered packaging size for a product. Resolve package preference and reporting detail before production use.

### Private roster feasibility check

- Earlier dashboard review recorded owner-matching RLS on all four operations. The save function derives ownership from the signed-in user and checks revisions. Independent live signed-out and second-account tests remain pending.
- `node tests/private-roster-check.cjs` passed against the draft with synthetic rows. Mock account transport and local storage preserve field IDs, the 2026 baseline, the 2027 override and historical note references. This does not exercise live Supabase or browser persistence.
- The existing full-device JSON validator accepts a matching roster and rejects an empty or different roster. Fresh-device offline recovery needs a validated bootstrap that stages the roster and dependent data and commits them in the same local transaction. Preserve existing field IDs and fail safely if the backup does not match an already-initialized device.
- No app code, deployment, database configuration, or real-device QA changed. The check can be removed by reverting its commit.

- [x] Simulated fresh-device JSON recovery validates the roster, preserves annual settings and note IDs, and writes all three in one transaction. Duplicate fields, orphan notes, roster mismatch, and a concurrent initialization are rejected. Existing synthetic planner/spray/cache checks passed.
- [ ] Verify a real offline restore on desktop and iPad using an isolated no-roster test shell. Workspace Chromium cannot open a process socket here. Live Supabase was not exercised.

- [x] Mock private roster provisioning requires an account, filters by owner, rejects missing rows and account drift during provisioning, then reloads from the local roster.
- [ ] Exercise account isolation and private roster provisioning against a synthetic test backend before enabling the roster-free shell. Real-device recovery testing deferred at user direction.

### Live roster authorization check

Run `node tests/private-roster-supabase.cjs` with an isolated Supabase origin, publishable key and two disposable authenticated sessions. The script refuses the app's configured backend and uses a unique synthetic settings key. It verifies owner save/read plus signed-out and second-account read isolation. The sample row remains in the disposable project for inspection. Never pass a service-role key.

- [x] Runner syntax and missing-configuration guard checked. Existing simulated roster, recovery, planning and cache checks passed.
- [ ] Live run needs the isolated Supabase project and disposable sessions. Device recovery remains deferred.

### Roster-free QA shell

Run `node scripts/build-private-roster-qa.cjs` to generate an isolated QA bundle in a temporary directory. Host it only on a separate QA origin so its service worker cannot control either existing app. The default build disables cloud initialization. To exercise signed-in provisioning, configure `FIELD_SCOUT_QA_URL` and `FIELD_SCOUT_QA_PUBLIC_KEY` for an isolated Supabase project, then seed the reserved `v7-private-roster-v1` row for a disposable account with sample rows using operator code `SAMPLE`.

- [x] Generated cloud-disabled and synthetic-endpoint builds. Inline JavaScript parses, existing mock and regression checks pass, and the configured app backend is rejected.
- [ ] Live sign-in and roster loading need a separate Supabase project and disposable users. No existing app deployed or real roster migrated.
