# Field Scout V7.3.0 foundation test — November 23, 2026

Starting point: the user-provided V7.2.5 HTML, retaining existing database name and settings schema for compatibility.

## Changes

1. `annualForYear`: baseline is 2026; later years are unconfirmed unless explicitly set. Existing earlier annual records are treated as confirmed for compatibility.
2. `identityForYear`: optional future-dated name/farmer changes; global V7.2.5 corrections remain readable.
3. New Planning year review and confirm/edit workflow; field-edit button remains on the Fields / Notes header.
4. History defaults to all crop years; current-year filter is optional. New scouting notes include a snapshot of field info.
5. Active follow-up comes from the most recent non-deleted visit, including visits that explicitly chose no follow-up. Old dates remain on historical notes but do not reappear as live tasks.
6. Daily Plan supports unconfirmed fields without omitting them from the group display.
7. Confirmed field data gate in spray order calculation and crop choices.
8. Settings sync downloads refresh annual and field UI state; spray data receives a refresh notice. The selected crop year is kept device-local.
9. Cloud import retries after offline startup when online, rather than becoming permanently unavailable until reload.
10. Service worker version bump, offline precache, scoped old-cache deletion; PWA icons added to this package.

## Not changed / not claimed

- No user test data were deleted locally or from the cloud.
- No production GitHub deployments or Supabase database migration were performed.
- Not a comprehensive offline/sync security audit. App still embeds farmer/field information in public site source.
- Chemical/fertilizer Field Plan, reported fall herbicides, farmer completion checkbox and post-spray revisit are future design work, not enabled in this release.
## V7.4.0-dev — Field Plan review branch

Built against the V7.3.0 foundation commit `1587988cd03d17a3b2146824e47356698c19542f`.

- Added a crop-year Field Plan under Planning. Batch entries by farmer and crop, with confirmed field selection, herbicide revisions, free-text prepay, fall herbicide, strip-till, broadcast and farmer-reported status. Optional links retain the spray recipe ID and display name at save time.
- Plans use additive settings records, with no IndexedDB schema upgrade. Concurrent revisions retain both entries and show overlapping updates per field and operation until a correction is saved.
- Added settings pagination by record key, clarified daily snapshot wording, and scoped the new offline cache to the install path. Hid the older scouting-only backup/import controls. Full-device JSON and CSV remain available.
- Node checks passed for plan history and overlapping revisions, synthetic mixed-unit spray totals and package rounding, frozen calculation inputs and simulated service-worker caching. Browser launch in the workspace was blocked. Live Supabase policy and sync, iPad and desktop offline behavior, and full restore are pending.
- Review branch only. Roster migration, fertilizer calculator, Farmer Notes and spray order generation from the plan remain planned.

### Offline roster recovery (draft)

Full-device JSON can initialize an empty local roster with the backup’s validated field rows, notes and settings in one IndexedDB transaction. Stored rosters reload locally. An initialized installation still requires a matching roster. No cloud schema change or deployment. Rollback before merge is to revert this draft change.

### Authenticated roster loading (draft)

A roster-free shell can read its signed-in account’s pre-provisioned roster, validate it, and store it locally for offline access. Normal sync waits for successful provisioning. Existing bundled-roster behavior stays in place pending migration. No cloud row was created and no app was deployed. Revert the draft commits to roll back.
