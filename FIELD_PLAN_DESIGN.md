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