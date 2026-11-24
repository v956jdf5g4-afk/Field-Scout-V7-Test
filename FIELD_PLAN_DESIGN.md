# Future combined Field Plan — design agreement (NOT implemented in V7.3.0)

Purpose: one consultant's offline-first field management tool, not a public farm-management platform and not an applicator recordkeeping system.

## One crop-year Field Plan per field

- Stable Field ID, farmer, year, crop, confirmed acres.
- **Chemical plan**: original herbicide choices and later revisions; link to existing spray recipes; anticipated quantities vs farmer-reported prepay quantities. Prepay is NOT proof that product was applied.
- **Fertilizer plan**: planned strip-till and broadcast program and status; no required purchase/accounting module.
- **Work/status timeline**: what is still needed vs what was reported completed, with date reported and optional reported work date. Example: strip-till fertilizer complete, broadcast fertilizer pending, fall Valor/atrazine work reported complete.
- Fall calendar-year work (e.g., October 2026) may be associated with a 2027 target crop-year plan. Keep both dates/years.
- Farmer-level view and bulk field selection are mandatory for efficient updates.

## A small, auditable data model

- `field`: permanent internal ID and familiar field code, with archival support.
- `field_year`: key (field_id, crop_year), crop, acres, confirmation timestamp, revision.
- `field_plan`: field_id, crop_year, plan_type ('chemical' / 'fertilizer'), original plan, current revision, updated time.
- `work_event`: unique ID, field_id, target_crop_year, category, reported completion state, reported date, reported work date, product names if relevant, source ('consultant' / 'farmer report'), notes, correction history.
- `spray_followup`: unique ID, field_id, source work_event_id, due date from reported spraying date plus configurable 5–7 days, completed state.

## Explicit scope exclusions

- The optional six-section field grid is retired permanently.
- AI weed extraction and predictive scouting intelligence are deferred.
- No regulatory pesticide application recordkeeping module, no claims that the app verifies an application happened, and no requirement for applicator/weather/nozzle/label details.
- No public customer accounts, subscriptions, multitenant billing, or general-purpose inventory platform.

## Principle

The answer to **What was planned? What has been done? What remains?** should be available in one or two taps, including when offline.
## V7.4.0-dev implementation on the review branch

Planning has a combined Field Plan. Each save is a single additive settings record with an ID, target crop year, field snapshots, entry type, status, text, time entered, optional farmer-reported work date and optional existing spray recipe reference. Prepay is recorded as a planning note. Saving never changes a spray assignment or order. Revisions identify predecessor entries independently for each field and operation, so overlapping updates are visible instead of silently replaced. Each category represents one current program or operation summary per field/year. Multiple passes within a category and a structured prepay quantity editor are future work.

The existing full-device JSON includes all plan settings. The existing authenticated settings sync is the intended transport, pending live verification. Rollback before deployment is to keep the review branch unmerged. After a future deployment, export full-device JSON and preserve the additive records if rolling back the app shell. The earlier shell cannot display Field Plans. Preserve records and test restoration before any data cleanup.

### P0 privacy gate

The existing public app shell still contains the roster. It should move to owner-authorized storage and be cached on this device after authenticated setup or provisioned from a verified local backup. Keep stable field IDs and preserve the baseline year, note links and historical snapshots. Audit Supabase table policies, grants and the save RPC before consenting to use real plan data. Test owner and non-owner behavior with synthetic data. Inventory old Pages artifacts, public Git history, and caches separately since changing the current shell does not retract earlier copies. Confirm offline startup on a configured iPad and first-time setup in an empty browser before switching the roster source. See the official Supabase guide at https://supabase.com/docs/guides/database/postgres/row-level-security.

Farmer Notes, supported soil-test recommendations and blend math remain approved future work. Keep those records out of the static bundle and validate recommendations against applicable extension source examples before use.

### Private roster recovery prerequisite

Store a restored roster under a device-local setting excluded from cloud settings sync. Load it before validating historical field references or rendering crop filters. Legacy full-device JSON already carries the baseline roster in `staticFields`, so the backup format remains version 1. Live account-based roster download and removal of bundled names are subsequent work.

The authenticated roster loader reads the owner-scoped `v7-private-roster-v1` record from the existing settings category. Cloud and local roster metadata are excluded from generic settings sync. A matching owner binding is required for later sync. A backup-restored roster needs an exact match against the account roster before the app binds it. Provisioning real records and removing bundled names are separate changes.
