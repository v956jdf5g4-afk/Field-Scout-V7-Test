# Field Scout — private roster migration plan (DESIGN ONLY)
Date: 2026-11-23
Branch: privacy/roster-migration-design
Base: V7.3.0 Foundation Test, main commit 1587988cd03d17a3b2146824e47356698c19542f
Status: Design review. NO application, Supabase, production, or live user-data changes have been made.

## Verified exposure
- The public test repository's index.html contains a literal `const fields=[...]` with real field identifiers, field names, acres, 2026 crops, and operator codes.
- GitHub Pages serves the HTML to anyone. A client-side opening password does not conceal its source.
- `annualForYear` uses this literal roster as the 2026 baseline; `identityForYear` layers corrections over it. Simply deleting the array would break historical field lookups and year defaults.
- JSON full-device backup and recovery snapshots include `staticFields:fields`. Any migration must preserve compatibility with already downloaded backups.
- Settings are synchronized through the `field_scout_sync` table and `field_scout_save` RPC. The actual database RLS, table policies and RPC security configuration have NOT been independently verified.
- The repository is public, and previously published commits remain accessible even after a new release removes the roster.

## Non-negotiable preservation
Keep stable field IDs, 2026 baseline crops/acres, effective-dated farmer/name changes, annual confirmations, notes, spray recipes/orders, follow-ups, conflict handling, and existing backup restoration. No real records deleted or re-keyed. No production deployment without approval.

## Recommended architecture
1. **Authoritative roster**: authenticated, per-account records in Supabase, with verified RLS and server-side authorization for both reads and writes. Use the existing user's account; do not introduce multi-user business workflows.
2. **Offline copy**: persist a validated roster locally in IndexedDB; load it before rendering fields. Use stable field IDs, version/revision metadata, and conflict-safe synchronization.
3. **Migration seed**: privately import the exact existing 2026 baseline once into authenticated storage, preserving all field codes, names, operator codes, crops and acres. Do not commit the seed JSON/SQL to a public repository. Never overwrite a newer roster from a stale device.
4. **Public client**: replace the literal farmer/field roster with an empty bootstrap and an explicit **roster not yet initialized on this device** state. An unauthenticated fresh browser must not see actual field names or acres. On a previously authorized device, the cached roster should remain available offline.
5. **First-run recovery**: if there is no local roster and the user is offline, show a clear explanation; do not silently synthesize or substitute a fake roster. Authenticate online once to download the roster.
6. **Versioned backup/restore**: continue accepting existing `FieldScoutV71FullDeviceBackup` files containing `staticFields`, and add a backward-compatible, validated roster snapshot to future backups. Restore only in a controlled, offline context, with explicit preview and confirmation.
7. **Revisions**: coordinate roster and annual/identity settings updates; ensure conflict detection and no silently lost edits. Do not rely on sync status alone to assert backup completeness.
8. **Deployment**: audit cloud policies first, migrate seed with a separately approved private path, then ship code to TEST and run device tests. Only after acceptance consider production.

## Security questions to resolve before implementation
- Does `field_scout_sync` have RLS enabled and FORCE RLS where appropriate? What are the actual SELECT/INSERT/UPDATE/DELETE policies?
- Is `field_scout_save` SECURITY DEFINER or INVOKER? Does it verify `auth.uid()`, record ownership, allowed categories, and expected revisions? Can an anonymous or another account read/write rows?
- Is there a public `anon` SELECT policy or an unsafe RPC that bypasses RLS?
- What is the current authenticated account's stable identifier, and how will owner authorization be enforced without exposing credentials?
- Are there public historical GitHub releases, artifacts or other URLs exposing the roster? Treat previously exposed data as already disclosed; removal from current HTML cannot retract old commits.
- Are existing cloud backup rows protected, and can one user read another user's snapshots?

**Do not paste passwords, service-role keys, access tokens, or full farmer/field data into ChatGPT, GitHub, or this document.** Only share policy definitions and redacted schemas if needed.

## Implementation stages and explicit gates
A. Obtain/read redacted Supabase schema, RLS policies, and RPC definition; review authorization. **Gate: user approval before any database changes.**
B. Add automated tests for authenticated roster access, offline cached roster, fresh offline browser, annual 2026/2027 fidelity, missing roster, sync conflicts, and backup compatibility.
C. Create a migration/import mechanism with a dry-run field count, IDs, checksums, and rollback. Import real roster privately, never as a committed public fixture.
D. Change TEST client to read authenticated roster and cached IndexedDB; remove literal source array and update SW cache version. Include clear failure/recovery UI.
E. Validate computer/iPad offline and cloud flows, historical notes and spray orders, backup restore, interrupted sync, and rollback.
F. Update CHANGELOG, QA_CHECKLIST, and SOP with commit, test evidence, risks. Production stays untouched pending explicit approval.

## Tests required for release
- Anonymous incognito browser source and UI reveal **zero real field/farmer records**.
- Fresh authorized online device loads complete roster and correct 2026 baseline; existing authorized offline device works.
- 2026/2027 crop-year values and effective-dated identity changes remain unchanged.
- Existing historical notes, farmer grouping, spray recipes/orders and follow-ups still resolve field IDs.
- Offline edits sync correctly; same-field concurrent changes cause explicit review, not silent overwrite.
- Old and new full-device JSON backups restore in isolation, with correct field count and annual records.
- A clean rollback to the prior test build is documented; **privacy is not fixed by rollback to a build that exposes the roster**.

## Current result
Only this review/design document was added on a separate TEST repository branch. No application changes, database writes, migration, production updates, or device tests were performed. Next action: obtain **redacted** Supabase policy/schema/RPC definitions for a targeted authorization review.
