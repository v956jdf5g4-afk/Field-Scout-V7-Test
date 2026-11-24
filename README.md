# Field Scout V7.4.0-rc1 — isolated SAMPLE QA

This is a generated review build of the Field Scout test repository. Source checkpoint: `53d623d58ce836bd55cb8a0f02225e251995c3e3` in draft PR #2. It has four synthetic fields, two sample farmers, a separate IndexedDB namespace and no configured cloud backend. It is not the live test or production app. Do not add real farmer data. Earlier Git history may contain the original bundled roster; this generated tree excludes it.

## Launch locally for desktop QA

Download this branch as a ZIP and extract it. From its folder, run `python -m http.server 8765 --bind 127.0.0.1` (or serve the folder on another isolated local web origin). Open `http://127.0.0.1:8765/`. Use an unused port/origin if it already hosts another app. Do not host under the existing Field Scout Pages origin. The app's cloud initialization is disabled; this build is for local UI and offline/reopen checks, not cross-device sync.

## Targeted QA

1. Planning: add a sample farmer note with a call reminder; verify history across crop years and complete the reminder.
2. Field Plan: create a bulk planned operation for TEST1 and TEST2, revise only one, add a second pass and inspect both histories. Confirm prepay is a shared quantity, not proof of application.
3. Create a synthetic spray recipe, save its snapshot in a plan, preview and save a planned order; edit the source recipe and verify the saved order retains original inputs.
4. Soil Tests & Fertilizer Blends: enter a sample test, calculate a supported recommendation, check unavailable nutrients remain blank, save a blend and optionally link it to a planned field operation. Review product rates, nutrient balance, tons and cost.
5. Reload offline after the worker installs. Verify local records persist, export full-device JSON, and test offline recovery only on an isolated device.

Automated calculation, history, validation and simulated-cache checks have passed on the review source. Actual desktop/iPad UI, IndexedDB restore, live backend authorization and sync remain unverified. ND corn/spring wheat economic N and sulfur remain manual-review cases. Production and existing live test deployment are unchanged.
