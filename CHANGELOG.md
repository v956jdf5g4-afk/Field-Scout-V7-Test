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