# Bojeno — Project Brief (v2 planning doc)

*Local-first job-search automation desktop app. This document is the seed input for Claude Code sessions. Owner role: product vision + testing only — minimal code review, no line-level edits. All decisions below are made to be re-readable by a fresh Claude Code session without re-deriving context.*

---

## 1. One-liner

A local-first, open-source desktop app that automates the tedious parts of job hunting — discovery, outreach, applying, tracking — across LinkedIn and Naukri to start, expanding to other popular and niche job platforms over time, while staying fully visible and user-controlled. Not an auto-apply spam bot; a personal job-search command center.

## 2. Why / positioning

- **Not** "auto-apply to 1000 jobs" (AIHawk-style pitch — 30k+ stars but drew real recruiter/platform backlash). **Is**: discovery + outreach + tracking, automation as a visible tool the user drives.
- Local-first, BYOA/BYOK: logins, data, and any LLM key live on the user's machine. This is an honest privacy pitch.
- Fully visible automation only. No mode where a run's output is hidden from the user — rejected outright, not deferred. Scheduled (cron-defined) runs are permitted, but a schedule is a user-defined visible setting, and every triggered run still shows in the browser pane and logs to `run_logs` the same as a manual run. "Visible" describes the output, not whether a human clicked the button.
- Open source. No public plugin marketplace in v1 (adapter interface designed now, review/vetting gate built later).
- Secondary goal, explicitly real: daily build-in-public content (pseudonym) doubles as portfolio/marketing regardless of whether the tool itself goes viral. Success metric to anchor on: working tool + real usage + the user's own job outcome — not virality.

## 3. Architecture (final)

```
┌─────────────────────────────────────────────────────────────┐
│  Electron (TypeScript, strict mode, from commit 1)            │
│                                                                 │
│  ┌──────────────── LEFT ────────────┐ ┌────── RIGHT ────────┐│
│  │  Profile     (user data,         │ │  WebContentsView tabs:│
│  │  answer-bank, import adapters)   │ │   - LinkedIn (session) │
│  │  Dashboard   (feature cards,     │ │     persist:linkedin-  ││
│  │  mode switch: read-only/         │ │     <instanceId>       │
│  │  dry-run/live; kill switch)      │ │   - Naukri (session)   │
│  │  Job Tracker (aggregated view,   │ │     persist:naukri-    │
│  │  SQL joins across all sources,   │ │     <instanceId>       │
│  │  run_mode/is_synthetic filter)   │ │  Real, visible,        │
│  │  Settings    (telemetry opt-in,  │ │  user's own logged-in  │
│  │  off by default — crash reports  │ │  session — nothing      │
│  │  opt-in too; LLM key)            │ │  hidden                 │
│  └───────────────┬───────────────────┘ └──────────┬───────────┘│
│                   │  IPC — typed contract (shared TS types)     │
│                   ▼                                 │            │
│  ┌─────────────────── Main process ──────────────────┐         │
│  │  Adapters (capability-based, kind: session | api)   │        │
│  │  — session adapters (LinkedIn, Naukri): view + CDP  │        │
│  │    + login gate. API adapters (Greenhouse, Lever,   │        │
│  │    Ashby, SmartRecruiters, Workday): fetch only,     │        │
│  │    no view, no login gate.                           │        │
│  │  Mode gate + kill switch — checked at action-time     │       │
│  │  Rate-limit ledger — rolling-window action budget,    │       │
│  │  keyed per account/platform/action_type               │       │
│  │  Scheduler — user-defined cron entries; circuit       │       │
│  │  breaker auto-disables a schedule after N consecutive │       │
│  │  auth_required / selector failures                    │       │
│  │  Playwright via connectOverCDP (loopback, random      │       │
│  │  debug port; page target selected by URL) → attaches  │       │
│  │  to the already-open WebContentsView                  │       │
│  │  Structured logger → run_logs                         │       │
│  └───────────────┬─────────────────────────────────────┘        │
│                   ▼                                              │
│         node:sqlite — single file, timestamped migrations,       │
│         applied_migrations table, timestamped backup copy        │
│         before every migration (see §3b for full schema)         │
└─────────────────────────────────────────────────────────────┘

Dev loop:  electron-vite (Vite HMR for renderer, auto-restart main/preload)
Packaging: electron-builder — deferred until after script #1 is wrapped
```

## 3a. Project structure & first-feature conventions

```
bojeno/
  src/
    main/
      index.ts
      window.ts
      modes.ts                 # read-only / dry-run / live gate + kill switch
      ipc/
        channels.ts            # channel name constants: "<domain>:<action>"
        handlers/
          linkedin.ts
          naukri.ts
          ats.ts
      adapters/
        types.ts                # Capability, Adapter interface (session | api)
        registry.ts              # id -> Adapter lookup, both kinds in one registry
        linkedin/
          adapter.ts
          selectors.ts           # all LinkedIn selectors, centralized
        naukri/
          adapter.ts
          selectors.ts
        ats/
          greenhouse.ts
          lever.ts
          ashby.ts
          smartrecruiters.ts
          workday.ts
      ledger/
        actionBudget.ts          # rolling-window rate-limit ledger
      scheduler/
        index.ts                 # user-defined cron entries, circuit breaker
      operations/                # cross-cutting, non-adapter-specific (e.g. enrich-company.ts)
      db/
        index.ts                 # node:sqlite connection
        migrations/
          20260911T1430_init.sql # timestamp-prefixed, not sequential — worktrees collide on sequential numbers
        queries/                 # one file per table/domain
    preload/
      index.ts
    renderer/
      src/
        components/
          Dashboard/
          Tracker/
          Profile/
          Settings/
    shared/
      ipc-contract.ts            # payload types, imported by main + preload + renderer
      types.ts                   # domain types: Job, Company, Application, RunLog...
  migrations backups/            # timestamped .sqlite copies, gitignored
  CLAUDE.md
  CONTRIBUTING.md
```

**Adapter interface** — capability-based, not a single flat `PlatformAdapter`. ATS providers (Greenhouse, Lever, Ashby, SmartRecruiters, Workday) have no login, no session, no view — their rate limits are HTTP request budgets, not action budgets. A single interface has to carry that split explicitly, because the engine branches on it: whether to spin a `WebContentsView`, whether the login gate applies at all, which ledger dimension to charge.

```ts
type Capability =
  | 'checkLogin' | 'appliedCount' | 'discover' | 'apply'
  | 'findCompany' | 'findInsiders' | 'findHiringPosts'
  | 'connect' | 'askReferral';

interface Adapter {
  id: string;                    // 'linkedin' | 'naukri' | 'greenhouse' | 'bayt'
  kind: 'session' | 'api';       // session → view + CDP + login gate; api → fetch only
  capabilities: Set<Capability>;
  checkLogin?(): Promise<LoginStatus>;   // present iff kind === 'session'
  discover?(p: DiscoverParams): Promise<JobSourceRow[]>;
  appliedCount?(): Promise<number>;
}
```

Both kinds write into the same `job_sources` table — this is what makes ATS genuinely first-class rather than a bolted-on pipeline. No inheritance, no `this`-binding — same functional pattern already used for `enrich-company.ts` and the import adapters, so there's one adapter shape across the whole codebase.

**Electron/CDP specifics:**
- Use `WebContentsView`, not `BrowserView` — deprecated since Electron 30, now a compatibility shim.
- Set `setBackgroundColor("#00000000")` — the view defaults to a white background otherwise.
- `--remote-debugging-port` on loopback, random port. `connectOverCDP` sees the app's own renderer too — select the target page by URL, don't assume index 0.
- Partition names are instance-scoped: `persist:<platform>-<instanceId>`, with `instanceId` sourced from the same worktree config that already scopes `userData` and the SQLite path (§4, git workflow) — otherwise parallel worktrees bleed sessions across each other.

**First-feature conventions (apply from feature 1 onward):**
- Selectors live only in each adapter's `selectors.ts` — never inline in adapter logic — so a selector failure can be logged as "which selector, which file" without guessing.
- Login state and applied-count are **always read live** from the DOM on each check — never cached in memory — then the result is written through to SQLite so the left panel reads from the DB like every other view, not a one-off in-memory shortcut.
- Not-logged-in state: dashboard shows a "Not logged in — Log in now" banner per platform. Clicking it switches the browser pane to that platform's tab and navigates to the login page; the user completes login manually in the visible pane, no credential handling by the app.
- IPC channels named `<domain>:<action>` (e.g. `linkedin:checkLogin`, `linkedin:getAppliedCount`) from the first channel defined onward.
- Failure logging detail (what gets captured beyond the baseline fields) is decided per feature, not a fixed universal rule — but the baseline fields (§3b, `run_logs`) are non-negotiable from feature 1.

## 3b. Database schema (v2)

All tables defined in the first migration. Timestamp-prefixed migration filenames (`20260911T1430_init.sql`) plus an `applied_migrations` tracking table — not sequential integers, since parallel worktree branches would collide on the same next number.

- **`profile`** — user data, resume fields, answer-bank source. Each field carries `source: manual | linkedin_import | naukri_import`.
- **`companies`** (canonical) + **`company_identifiers`**`(company_id, source, external_id, raw_name)` — maps each source's own company reference back to one canonical row.
- **`jobs`** (canonical) + **`job_sources`**`(job_id, source, external_id, url, first_seen, raw_json)` — one canonical job can have multiple source postings (e.g. the same role on LinkedIn and via Greenhouse). Dedupe key: normalized title + company + location. An unmerge path (splitting a wrongly-merged `job_sources` row back into its own canonical job) is a deferred manual operation — seam only, not built in v1.
- **`applications`**, **`contacts`** — as before.
- **`run_logs`** — baseline: `timestamp, script, selector, outcome, duration, trigger_type (manual|auto|scheduled), triggered_by`. Extended: `run_id, step_index, entity_type, entity_id, error_detail (JSON), run_mode`. `outcome` is an explicit enum: `success | failed | auth_required | rate_limited | awaiting_input | skipped`.
- **`action_budget`**`(account_id, platform, action_type, window_start, count)` — rolling-window rate-limit ledger, persisted, keyed per account (two accounts exist — see §4, dual-account policy).
- **`saved_filters`** — as before, `match_mode: 'exact' | 'llm_assisted'` per criterion.
- **`answer_bank`** — table defined now, unimplemented. Same deferred-seam pattern as `match_mode`.
- **`settings`** — as before.
- **`run_mode` / `is_synthetic`** columns on `jobs`, `applications`, `contacts`, `run_logs` — tracker queries filter these by default with a visible toggle, so dry-run test data never silently pollutes the real tracker view.

## 4. Key decisions and why

| Area | Decision | Why |
|---|---|---|
| Browser engine | Chromium via Electron `WebContentsView`, not patched Firefox | Electron can't embed Firefox — would require a separate process/window, breaking the two-column layout. LinkedIn bans are driven mainly by server-side rate/pattern enforcement, not client fingerprinting, for single-account personal use. Existing scripts already have pacing solved. |
| Anti-detection | Preload script patches `navigator.webdriver` / CDP tells. No debugger-detach-between-actions — CDP has to stay live for Playwright regardless, so detaching adds operational cost without meaningfully reducing risk | Risk management moves to the rate-limit ledger instead, which better matches what actually causes bans (pattern/volume), rather than trying to win a fingerprinting arms race. |
| Automation layer | Playwright via `connectOverCDP()` against the `WebContentsView`, not hand-rolled CDP calls. Loopback, random debug port; select the target page by URL since the app's own renderer is also visible over CDP | Reuses existing scripts' proven logic (shadow-DOM handling, retries, pacing) with a one-line change (how `page` is obtained) instead of reimplementing Playwright's engine. |
| Adapter interface | Capability-based `Adapter` (`kind: 'session' \| 'api'`, `capabilities: Set<Capability>`), not a flat single-shape interface | ATS providers have no login/session/view and HTTP-budget rate limits, structurally different from LinkedIn/Naukri. The engine branches on `kind` for view/login-gate/ledger-dimension — a single flat interface would misrepresent that split. Both kinds write into the same `job_sources` table, keeping ATS first-class rather than a separate pipeline. |
| Per-platform isolation | One `WebContentsView` per platform, each its own `persist:<platform>-<instanceId>` partition, swapped into a tab strip | Gives tab UX and login isolation for free. Instance-scoped naming prevents parallel worktrees from sharing sessions. |
| Login gating | Simple login-check utility acts as a gate before any session-kind adapter action runs (API adapters have no login gate) | Prevents silent failures against a logged-out session; produces an explicit `auth_required` outcome in `run_logs` and a blocking dashboard banner instead of a buried failure. |
| Local storage | SQLite via Node's built-in `node:sqlite` (`DatabaseSync`), not `better-sqlite3`, not per-tool JSON/JSONL, not `sql.js`. **Changed from the original plan** (see note below) | Job tracker aggregates across platforms — a relational join, not a per-file scan. A sync API is what this workload wants either way. `better-sqlite3` was the original choice for its sync API and (assumed) reliable prebuilt bindings, but on the actual dev machine no prebuilt binary existed for this Electron version and no C++ compiler was installed to build it from source — installing one was rejected in favor of `node:sqlite`, which ships inside Electron's own bundled Node (confirmed present: Electron 39.8.10 bundles Node 22.22.1) and needs zero native compilation, on this machine or any future one. Tradeoff: `node:sqlite` is marked experimental in Node and its API could still change. Export-to-JSON is a flat dump command, built last, not a sync feature. |
| Credentials | Platform logins: never touched by the app — Chromium's own cookie storage per partition holds the session. Optional LLM key: Electron `safeStorage` (OS keychain-backed) | The app has nothing to protect for platform logins — stronger privacy claim than "stored securely," because nothing is stored. `safeStorage` is the one real secret-management need; warn (don't silently degrade) if no Linux keyring daemon is present. |
| Language | TypeScript everywhere (main, preload, renderer, ported scripts), `strict: true` from commit 1 | Solo dev, no code review layer — the compiler is the review layer. Directly prevents IPC-payload-mismatch bugs. Loosening strictness later is far more painful than starting strict. |
| IPC | One shared typed contract file, imported by both main and renderer | Prevents payload-shape drift between processes — a boring fix for a disproportionately expensive bug class. |
| Telemetry | Crash reports **and** opt-in usage stats both OFF by default — crash reporting is opt-in too, not a special case. Whatever would be sent is composed into the same local `run_logs` the user already sees, then sent — one code path, not two | Makes "nothing hidden" true by construction, not by policy — a payload can't diverge from what the user already saw. |
| Logging | Structured rows in `run_logs` (see §3b for full field list, including explicit `outcome` enum and `run_mode`), not console output | Primary debugging tool since the owner doesn't read diffs — verification is behavioral, via logs and tracker UI. Built into the shared helper so every adapter action gets it for free. |
| Modes | Global read-only / dry-run / live switch plus a kill switch (abort current run + disable all schedules), checked at action-time, no restart required | `dry-run` is the primary iteration tool. `read-only` skips all writes for pure inspection. The kill switch is a required safety rail before the scheduler ships — one unattended action-type gone wrong needs a single stop, not a hunt through settings. |
| Rate limiting | Shared `action_budget` ledger in the main process, consulted by the same helper that does mode-gating and logging. Lands with the first wrapped feature (`connect.mjs`), not added later | Rate limiting was previously per-script and implicit ("pacing already solved" in the old scripts) — making it a shared, queryable ledger from day one avoids retrofitting it across every adapter once several already exist without it. |
| Scheduled automation | Cron-defined, user-visible schedules permitted; a scheduled run still drives the visible browser pane and logs identically to a manual run. Circuit breaker auto-disables a schedule after N consecutive `auth_required`/selector failures. Requires the kill switch and circuit breaker to exist before the scheduler ships | Reconciles "no hidden output" with unattended runs — what's rejected is hiding a run's activity, not the absence of a click. The circuit breaker prevents an unattended schedule from hammering a broken selector or a logged-out session indefinitely. |
| Dual-account policy | An existing account from a prior shared project — already slated for deletion — is repurposed as the test account. The real personal account stays read-only for a new feature until it has N clean live runs against the test account (N to be set per feature, not fixed globally) | Gives a real live-mode test target without risking the account actually used for the job search, at zero extra cost since the test account was going to be deleted anyway. |
| Diff-review scope | Explicit, bounded review checklist: `db/migrations/*.sql`, `shared/ipc-contract.ts`, `shared/types.ts`, `*/selectors.ts`, `main/modes.ts`, the rate-limit ledger. Everything else unreviewed by design | Turns "minimal code review" into a concrete rule instead of an ambiguous intention — these are the files where a silent error would corrupt data, break the process boundary, or bypass a safety gate; everything else is either UI (behaviorally verified) or automation logic (verified via dry-run). |
| Migrations | Timestamp-prefixed SQL files + `applied_migrations` table (not sequential integers); timestamped file-copy backup before each migration | Sequential filenames collide across parallel worktree branches creating migrations independently. Backup makes a bad migration recoverable instead of a lost job search. |
| Dev loop | `electron-vite` (not hand-assembled Vite + nodemon + electron-reload) | Purpose-built for Electron: HMR for renderer, fast rebuild/auto-restart for main/preload, one config. Current de facto standard, actively maintained. |
| Filters | Structured rules engine (`saved_filters` table → SQL `WHERE` predicates), not LLM-first | Deterministic, debuggable via the activity log, zero API cost/hallucination risk, covers most filter needs without any model call. |
| LLM seam | `match_mode: 'exact' \| 'llm_assisted'` per filter criterion in the schema now; `llm_assisted` unimplemented until added | Same deferred-adapter pattern used for plugins/answer-bank/import — design the seam now, build the smarter implementation later without a schema rework. |
| Missing company data (size, sector) | `operations/enrich-company.ts`: input = company name, output = `{size, sector, source}` row in `companies`. v1 implementation = manual lookup by the owner; later = scraped/API; later still = LLM-assisted | Job boards/ATS providers don't expose company size/sector as structured fields — this can't be skipped, only staged. Same interface across all three implementation stages means later automation is a drop-in swap, not a rebuild. |
| Profile / future sync | `profile` table separate from session/credentials; per-platform import adapters map into a shared schema; each field carries `source` | Profile data *is* the answer-bank source. `source` per field leaves room for conflict resolution when platforms disagree, without building sync logic now. |
| Automated tests | Three narrow categories, not skipped: migrations run forward on a fixture DB, `saved_filters` produce the expected result set, IPC contract round-trips. Sourced from each issue's own acceptance criteria, not a separate test-writing effort | Targets exactly the deterministic-logic gap that matters given the owner doesn't read diffs (filters, migrations, IPC), without attempting to unit-test the inherently flaky browser-automation layer — that stays verified via dry-run. |
| Git workflow | Worktrees per branch/feature instead of branch-switching, each running its own live Electron instance | No lost running state when switching work. Requires instance-scoped `userData` path, SQLite file, dev port, and view partition names (all keyed off the same `instanceId`) so parallel instances don't share sessions or DB. Only one worktree may run `live` mode against real accounts at a time. |

## 5. Feature inventory carried over from existing scripts

**LinkedIn (6, `kind: session`):** `connect.mjs`, `find-company-id(s)`, `find-insiders(-batch)`, `find-hiring-posts.mjs`, `ask-referral.mjs`, `find-easy-apply-jobs.mjs` + `apply-easy-apply.mjs`
**Naukri (2, `kind: session`):** `find-naukri-jobs.mjs`, `apply-naukri.mjs`
**ATS / discovery (5, `kind: api`, first-class platform group, not a bolted-on pipeline):** `fetch_jobs.mjs` + providers — Ashby, Greenhouse, Lever, SmartRecruiters, Workday. Each an `Adapter` with `capabilities: {'discover'}` initially. Eligibility logic ported from Python to **TypeScript**, not JS, for v1.

**First script to wrap end-to-end: `connect.mjs`** — most mature, lowest blast radius, standing comfort running it live. The rate-limit ledger and diff-review scope both land in this same PR since they touch the same shared helper.

## 6. Build order

0. Dev loop first: `electron-vite` hot reload working before any feature work.
1. Bare Electron app, one `WebContentsView` on linkedin.com, Playwright `connectOverCDP` attached (loopback/random port, target selected by URL) — prove DOM read + programmatic click works while window stays visibly open. The one real technical unknown.
2. Wrap `connect.mjs` end to end (dashboard trigger → visible run → structured log → mode gate → login gate → rate-limit ledger check). This becomes the template every other script copies.
3. Repeat for remaining 5 LinkedIn scripts, then 2 Naukri scripts — mostly wiring.
4. ATS/discovery adapters (`kind: api`) — no view, no login gate, simpler wiring than session adapters.
5. Local activity-log UI, job tracker aggregation view (with `run_mode`/`is_synthetic` filter), settings.
6. Kill switch + circuit breaker, then the scheduler — in that order, since the scheduler is gated on both existing first.
7. `electron-builder` packaging (not before this point) — dogfood solo, then small invite list before any public post.

## 7. Git / issue strategy

- **Every PR starts from a GitHub issue** — the issue *is* the spec (desired behavior + acceptance criteria: how the owner will verify it worked without reading the diff, and which of the three test categories in §4 apply if any). Create the issue if one doesn't exist.
- **Commit format:** `<type>(<scope>): #<id> <one-liner, imperative mood, no period>`
  Example: `feat(linkedin): #3 wrap connect.mjs through CDP bridge`
- **Types:** `feat | fix | chore | refactor | docs | test | perf`
- **Scope:** fixed vocabulary, lowercase, one word — `linkedin`, `naukri`, `ats`, `tracker`, `engine`, `db`, `dashboard`, `discovery`, `ledger`, `scheduler` — documented in `CONTRIBUTING.md`.
- **Branches:** `type/short-description`, one per issue. Worktree per active branch (§4).
- **Merge strategy:** squash-merge to `main` — keeps history readable; granular WIP commits allowed during development.
- Issue template: not finalized yet — start loose, refine after a few real issues.

## 8. Non-goals / explicitly deferred

- Public plugin/extension marketplace (adapter interface built now, review/vetting gate later — community adapters get DOM access to a real logged-in session, needs vetting before opening up).
- Automation whose output is hidden from the user — rejected outright, not deferred. (Scheduled/cron runs are in scope — see §4 — but still visible and logged like any other run.)
- Answer-bank editing UI (table defined now, unimplemented — resolved into the profile-store design; hand-editing acceptable for v1).
- Confirm-before-send friction on early live actions — considered, skipped for v1 in favor of the mode/login/ledger gates already in place.
- `selectors:healthcheck` read-only diagnostic command — considered, deferred, not blocking anything.
- Additional discover-only platforms (Indeed, Gulf Naukri, Bayt, GulfTalent) — considered, deferred past v1; the capability-based adapter model supports adding them later without a redesign.
- LLM-assisted filtering/enrichment (seams designed, implementation deferred).

## 9. Naming

Finalized: **Bojeno** (wordplay on "one job"). Used from here on for repo, docs, and all future references.

## 10. Repo setup

New repo, new pseudonym GitHub account, zero personal data from commit 1. Do not fork/branch from the `afterq` repo — its history (real name in commits, existing scripts) must never share a git log with the public project. This brief itself is the seed doc for that new repo's first Claude Code session.

## 11. Planning status and next steps

*This is the living, implementation-facing register. Keep it updated as a decision is made, work begins, completes, or is deliberately deferred. Do not create a competing next-steps document: this brief is the source of truth.*

### Confirmed product decisions (2026-09-11)

- **Internal API first:** product actions are exposed as typed internal IPC/domain commands, not a localhost HTTP server. The same commands will support the renderer now and may later be surfaced through MCP, a CLI, or an external API without moving platform logic into the UI.
- **Thin clients, modular actions:** browser automation, UI buttons, future command chaining, schedules, and LLM tooling must call the same domain commands. Existing monolithic scripts are reference material only; port their behavior as small composable operations, never as one giant wrapper.
- **Deterministic first:** build deterministic search/filter/workflow commands before introducing LLM orchestration. LLM-assisted filtering/enrichment remains a later seam, not a prerequisite for useful workflows.
- **Initial discovery proof:** LinkedIn plus one public ATS adapter (choose Lever or Ashby after inspecting the existing scripts in `C:\\Users\\i\\afterq\\tools`). Add platforms one at a time after a complete vertical slice works.
- **Data posture:** retain source/external IDs, URLs, normalized essentials, and raw capture where useful; do not overinvest in complex cross-source merging/unmerge tooling during v1. Good-enough storage and tracking now, refinement later.
- **Visual direction:** classic Windows 98 visual language with modern usability—not pixel-perfect emulation. Prefer a maintained, compatible library or icon set when it genuinely saves time; do not rebuild commodity UI/icon work for its own sake.
- **First user journey:** LinkedIn: define filter → scan → review jobs → save/blacklist companies → outreach/apply → track outcome.

### A. Development safety and verification

15. **Restore the documented verification commands.** Add `npm run check` (typecheck, lint, test) and `npm run devcheck` as described in `AGENTS.md`. **Why:** every later feature needs one reliable pre-commit check and one supported way to verify behavior in the real Electron renderer; the current documentation and `package.json` disagree.

16. **Verify the existing vertical slice in the running application before extending it.** Confirm login-state checks, visible LinkedIn/Naukri view switching, count fetches, recent LinkedIn application capture, SQLite writes, and run-log rows against the real app. **Why:** green static checks do not prove selectors, navigation timing, or visible layout work against live platform pages.

17. **Make the working-tree/runtime hygiene explicit.** Keep `.dev/` and migration-backup outputs untracked; check `git status --porcelain` before each implementation commit. **Why:** local CDP/runtime files and database backups must not leak into source control.

### B. Internal command API and workflow foundations

18. **Define a small internal command vocabulary.** Start with typed commands such as `jobs:discover`, `jobs:list`, `jobs:get`, `companies:setDisposition`, `filters:save`, `filters:run`, and `runs:cancel`; retain existing low-level platform actions behind these commands. **Why:** UI, schedules, chained tooling, and future MCP integrations gain one stable interface while selector/platform details remain isolated.

19. **Introduce a deterministic discovery request/result contract.** A request should carry criteria (keywords, location, remote, source selection, date/experience filters where supported); a result should carry normalized job essentials, source identity/URL, capture timestamp, and outcome/diagnostics. **Why:** every adapter can implement the same useful workflow without pretending they offer identical filters or DOM structures.

20. **Keep orchestration deliberately thin for now.** Use a deterministic dispatcher that selects requested adapters, applies existing locks/login/mode/logging conventions, and stores results. Defer multi-step LLM planning, autonomous retries, and tool selection. **Why:** this gives a clean seam now without delaying the first useful search flow.

21. **Inspect the legacy scripts before porting any discovery behavior.** Inventory `C:\\Users\\i\\afterq\\tools` by platform, inputs, outputs, dependencies, selectors, and side effects; extract only the smallest reusable operations. **Why:** the scripts contain proven behavior but their monolithic structure is not the architecture for Bojeno.

22. **Choose the first ATS adapter from evidence.** Compare Lever and Ashby scripts/endpoints for a stable public discovery path, simple pagination, useful company/job IDs, and low implementation risk; then implement only the winner. **Why:** one API-kind adapter alongside LinkedIn proves the session/API split early without committing to a broad ATS surface.

### C. Storage and tracking

23. **Add a minimal discovery storage migration.** Add canonical job records plus source identity/URL and essential company information, retaining raw capture only when it helps debugging or future normalization. Do not implement sophisticated fuzzy merging or unmerge UI. **Why:** scans must be reviewable and trackable across runs, while v1 avoids a data-management project.

24. **Define conservative duplicate behavior.** At minimum, upsert the same `(source, external_id)` on repeat scans and preserve first/last-seen timestamps. Cross-platform matching may be a best-effort later enhancement. **Why:** repeated scheduled/manual scans remain useful without producing a noisy tracker.

25. **Add company dispositions before company enrichment.** Support simple user-controlled states such as neutral, saved, and blacklisted, keyed to the captured company name/source identity. **Why:** the first journey needs practical filtering/control before size/sector enrichment or sophisticated canonical-company management.

26. **Build a queryable jobs read model before a rich tracker.** Support list/review filters for source, date seen, company disposition, and job status; keep the current applied-count chart as a separate metric view. **Why:** users need to review newly discovered jobs immediately, not wait for the full applications CRM.

### D. UI system and product shell

27. **Evaluate a compatible Windows-98-style UI foundation before writing primitives.** Test maintained options for React/Electron compatibility, accessibility, bundle health, theming flexibility, and license; adopt one only if it fits the app’s two-pane architecture. **Why:** a library may accelerate the visual baseline, but a poorly fitting novelty theme would create more work than a tiny local layer.

28. **If no library fits, create only a minimal local component layer.** Limit it to panels/windows, buttons, inputs/selects, tabs, status chips, data grid, progress, dialog, toast, and icon wrapper. **Why:** consistency and reusable behavior matter; a full custom design system does not.

29. **Use existing iconography where possible.** Choose a cohesive, license-compatible icon source with simple line/pixel-friendly icons, then adapt sizing/color to the classic theme. **Why:** recognizable navigation and action cues should not become bespoke illustration work.

30. **Replace the fixed prototype dashboard with a product shell.** Plan a compact header, left navigation, central workspace, visible docked browser pane with platform tabs, and activity/status region. **Why:** it reflects the intended command-center workflow while preserving transparent visible automation.

31. **Build the first UI screen around the LinkedIn discovery journey, not a generic dashboard.** It should let a user define/run a search, see progress/log outcome, review captured jobs, and set company disposition. **Why:** the UI earns its complexity only when it completes an actual user task.

### E. Incremental capability rollout

32. **Complete LinkedIn discovery as the reference vertical slice.** Implement deterministic filter → visible scan → normalized/store results → review list → saved/blacklisted company behavior → structured logs. **Why:** this establishes the reusable end-to-end pattern for every subsequent adapter.

33. **Complete one Lever-or-Ashby discovery slice using the same command and storage contracts.** It needs no browser view/login gate but must participate in the same job list and logs. **Why:** it validates that ATS adapters are first-class rather than a side pipeline.

34. **Add outreach/apply as separately gated commands after discovery/review is stable.** These commands must reuse action-time mode checks, login checks where relevant, locks, rate budgets, visible execution, and logs. **Why:** applying is higher risk than discovery and should build on a proven command boundary.

35. **Add saved filters and schedules only after the manual discovery command is dependable.** Scheduled runs must remain visible/logged and wait for kill switch and circuit-breaker work already specified in this brief. **Why:** an unreliable manual workflow becomes a harmful unattended workflow when scheduled.

36. **Add LLM assistance only after deterministic commands, data shapes, and audit logs are stable.** Connect it as an optional caller of the same command/query layer, with clear provenance and no ability to bypass safety gates. **Why:** the model becomes a useful planner/assistant rather than the place where core product logic hides.
