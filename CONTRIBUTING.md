# Contributing

## Issue-first

Every PR starts from a GitHub issue — the issue is the spec (desired behavior + acceptance criteria: how the owner will verify it worked without reading the diff, plus which of the test categories below apply, if any). Create the issue before writing code if one doesn't exist yet.

## Commits

Format: `<type>(<scope>): #<id> <one-liner, imperative mood, no period>`

Example: `feat(linkedin): #3 wrap connect.mjs through CDP bridge`

**Types:** `feat | fix | chore | refactor | docs | test | perf`

**Scopes** (fixed vocabulary, lowercase, one word): `linkedin | naukri | ats | tracker | engine | db | dashboard | discovery | ledger | scheduler`

Granular WIP commits are fine during development; squash-merge to `master` keeps history readable.

## Branches

`type/short-description`, one per issue.

## Before opening or updating a PR

- `npm run typecheck && npm run lint && npm run test` — all three, not just the one you think is relevant.
- If another PR touching the same shared files (`shared/*`, `main/index.ts`, `preload/index.ts`, `Dashboard.tsx`) merged since you branched, rebase onto `master` and re-run the checks above before opening/updating the PR — don't wait for GitHub to discover the conflict for you at merge time.
- Verify claims against the real running app where feasible (see `CLAUDE.md`), not just passing typecheck/lint. A green typecheck does not mean the selector is right.

## Test categories (per the project brief)

Only three kinds of automated tests are in scope — deliberately, not everything:

1. Migrations run forward on a fixture DB
2. `saved_filters` produce the expected result set (once that feature exists)
3. IPC contract round-trips

Pure/deterministic logic that isn't one of the above but has no external dependency (e.g. relative-time parsing) still gets a unit test. Browser-automation code itself is verified live, not unit-tested — it's inherently flaky in a way that doesn't shake out with mocks.
