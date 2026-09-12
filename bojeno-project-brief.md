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

## 3. Architecture (v0.1 scope)

*Cut down 2026-09-12 after four sessions of adding infrastructure (ledger, ATS adapter, capability registry) faster than any single user journey got proven end-to-end. Everything below is what v0.1 actually needs. Anything from earlier planning that isn't here was deliberately cut or deferred — see §13.*

```
┌─────────────────────────────────────────────────────────────┐
│  Electron (TypeScript, strict mode, from commit 1)            │
│                                                                 │
│  ┌──────────────── LEFT ────────────┐ ┌────── RIGHT ────────┐│
│  │  Dashboard   (mode switch:       │ │  WebContentsView tabs:│
│  │  read-only/dry-run/live)         │ │   - LinkedIn (session) │
│  │  Job Tracker (applied counts,    │ │     persist:linkedin-  ││
│  │  run logs)                       │ │     <instanceId>       │
│  │                                  │ │   - Naukri (session)   │
│  │                                  │ │     persist:naukri-    │
│  │                                  │ │     <instanceId>       │
│  │                                  │ │  Real, visible,        │
│  │                                  │ │  user's own logged-in  │
│  │                                  │ │  session — nothing      │
│  │                                  │ │  hidden                 │
│  └───────────────┬───────────────────┘ └──────────┬───────────┘│
│                   │  IPC — typed contract (shared TS types)     │
│                   ▼                                 │            │
│  ┌─────────────────── Main process ──────────────────┐         │
│  │  Adapters (LinkedIn, Naukri) — plain interface,     │        │
│  │  no capability/kind abstraction. Both have a view,  │        │
│  │  a login gate, and CDP.                              │       │
│  │  Mode gate — checked at action-time                  │       │
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
Packaging: electron-builder — deferred until v0.1 works end-to-end
```

## 3a. Project structure & first-feature conventions

```
bojeno/
  src/
    main/
      index.ts
      window.ts
      modes.ts                 # read-only / dry-run / live gate
      ipc/
        channels.ts            # channel name constants: "<domain>:<action>"
        handlers/
          linkedin.ts
          naukri.ts
      adapters/
        types.ts                # plain Adapter interface
        registry.ts              # id -> Adapter lookup
        linkedin/
          adapter.ts
          selectors.ts           # all LinkedIn selectors, centralized
        naukri/
          adapter.ts
          selectors.ts
      engine/                    # applyToJob.ts etc — mode gate + login gate + logging, per adapter action
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
    shared/
      ipc-contract.ts            # payload types, imported by main + preload + renderer
      types.ts                   # domain types: Platform, RunLog, ApplyResult...
  migrations backups/            # timestamped .sqlite copies, gitignored
  CLAUDE.md
  CONTRIBUTING.md
```

**Adapter interface** — a plain interface, not capability-based. Both v0.1 adapters (LinkedIn, Naukri) are the same shape: a view, a login gate, CDP. There's no second adapter kind yet to justify a `kind`/`capabilities` split — that abstraction was built once (for a since-removed ATS adapter) and cut because two adapters of one shape don't need a registry abstraction to distinguish them. Re-add a capability/kind split only when a second structurally-different adapter (no login, no view — e.g. an ATS fetch-only source) actually gets built, not before.

```ts
interface Adapter {
  id: string;                    // 'linkedin' | 'naukri'
  checkLogin(): Promise<LoginStatus>;
  appliedCount?(): Promise<ApplicationMetrics>;
  applyToJob?(jobId: string, dryRun?: boolean): Promise<ApplyResult>;
}
```

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

## 3b. Database schema (v0.1, as actually built)

Timestamp-prefixed migration filenames plus an `applied_migrations` tracking table — not sequential integers, since parallel worktree branches would collide on the same next number.

- **`run_logs`** — `timestamp, script, outcome, duration, trigger_type, entity_type, entity_id, error_detail (JSON), run_mode`. `outcome` is an explicit enum: `success | failed | auth_required | rate_limited | awaiting_input | skipped`.
- **`applied_counts`** — one row per fetch, `platform, metric, count, fetched_at` — the tracker's applied-count-over-time chart.
- **`applied_jobs`** — LinkedIn-scraped recent-applications rows (title, company, location, applied timestamp).
- **`apply_attempts`** — one row per `applyToJob` attempt: `platform, external_job_id, outcome, reason, header, dry_run, attempted_at`.
- **`company_blacklist`** — company names the apply flow refuses to attempt, checked before every apply.

Broader schema ideas from earlier planning (canonical `jobs`/`companies` merge tables, `profile`/answer-bank as its own table, `saved_filters`, `action_budget`) are deferred — see §13. Add a table when a feature actually needs it, not ahead of time.

## 4. Key decisions and why

| Area | Decision | Why |
|---|---|---|
| Browser engine | Chromium via Electron `WebContentsView`, not patched Firefox | Electron can't embed Firefox — would require a separate process/window, breaking the two-column layout. LinkedIn bans are driven mainly by server-side rate/pattern enforcement, not client fingerprinting, for single-account personal use. Existing scripts already have pacing solved. |
| Anti-detection | Preload script patches `navigator.webdriver` / CDP tells. No debugger-detach-between-actions — CDP has to stay live for Playwright regardless, so detaching adds operational cost without meaningfully reducing risk | Risk management for pattern/volume-driven bans is a v0.1-deferred concern (see §13) rather than trying to win a fingerprinting arms race now. |
| Automation layer | Playwright via `connectOverCDP()` against the `WebContentsView`, not hand-rolled CDP calls. Loopback, random debug port; select the target page by URL since the app's own renderer is also visible over CDP | Reuses existing scripts' proven logic (shadow-DOM handling, retries, pacing) with a one-line change (how `page` is obtained) instead of reimplementing Playwright's engine. |
| Adapter interface | Plain `Adapter` interface, no `kind`/`capabilities` split (cut 2026-09-12 — see §13) | Both v0.1 adapters (LinkedIn, Naukri) are the same shape: view + login gate + CDP. A capability-based split was built for a since-removed ATS adapter before it had a second real use — re-add it only when a structurally different adapter is actually being built. |
| Per-platform isolation | One `WebContentsView` per platform, each its own `persist:<platform>-<instanceId>` partition, swapped into a tab strip | Gives tab UX and login isolation for free. Instance-scoped naming prevents parallel worktrees from sharing sessions. |
| Login gating | Simple login-check utility acts as a gate before any session-kind adapter action runs (API adapters have no login gate) | Prevents silent failures against a logged-out session; produces an explicit `auth_required` outcome in `run_logs` and a blocking dashboard banner instead of a buried failure. |
| Local storage | SQLite via Node's built-in `node:sqlite` (`DatabaseSync`), not `better-sqlite3`, not per-tool JSON/JSONL, not `sql.js`. **Changed from the original plan** (see note below) | Job tracker aggregates across platforms — a relational join, not a per-file scan. A sync API is what this workload wants either way. `better-sqlite3` was the original choice for its sync API and (assumed) reliable prebuilt bindings, but on the actual dev machine no prebuilt binary existed for this Electron version and no C++ compiler was installed to build it from source — installing one was rejected in favor of `node:sqlite`, which ships inside Electron's own bundled Node (confirmed present: Electron 39.8.10 bundles Node 22.22.1) and needs zero native compilation, on this machine or any future one. Tradeoff: `node:sqlite` is marked experimental in Node and its API could still change. Export-to-JSON is a flat dump command, built last, not a sync feature. |
| Credentials | Platform logins: never touched by the app — Chromium's own cookie storage per partition holds the session. Optional LLM key: Electron `safeStorage` (OS keychain-backed) | The app has nothing to protect for platform logins — stronger privacy claim than "stored securely," because nothing is stored. `safeStorage` is the one real secret-management need; warn (don't silently degrade) if no Linux keyring daemon is present. |
| Language | TypeScript everywhere (main, preload, renderer, ported scripts), `strict: true` from commit 1 | Solo dev, no code review layer — the compiler is the review layer. Directly prevents IPC-payload-mismatch bugs. Loosening strictness later is far more painful than starting strict. |
| IPC | One shared typed contract file, imported by both main and renderer | Prevents payload-shape drift between processes — a boring fix for a disproportionately expensive bug class. |
| Telemetry | Crash reports **and** opt-in usage stats both OFF by default — crash reporting is opt-in too, not a special case. Whatever would be sent is composed into the same local `run_logs` the user already sees, then sent — one code path, not two | Makes "nothing hidden" true by construction, not by policy — a payload can't diverge from what the user already saw. |
| Logging | Structured rows in `run_logs` (see §3b for full field list, including explicit `outcome` enum and `run_mode`), not console output | Primary debugging tool since the owner doesn't read diffs — verification is behavioral, via logs and tracker UI. Built into the shared helper so every adapter action gets it for free. |
| Modes | Global read-only / dry-run / live switch, checked at action-time, no restart required. Kill switch deferred (see §13) since there's no scheduler yet for it to guard | `dry-run` is the primary iteration tool. `read-only` skips all writes for pure inspection. |
| Rate limiting | Deferred past v0.1 — see §13 | No scheduled/unattended runs exist yet to make an implicit per-action pace risky; add a ledger when the scheduler actually ships, not before. |
| Diff-review scope | Explicit, bounded review checklist: `db/migrations/*.sql`, `shared/ipc-contract.ts`, `shared/types.ts`, `*/selectors.ts`, `main/modes.ts`, the rate-limit ledger. Everything else unreviewed by design | Turns "minimal code review" into a concrete rule instead of an ambiguous intention — these are the files where a silent error would corrupt data, break the process boundary, or bypass a safety gate; everything else is either UI (behaviorally verified) or automation logic (verified via dry-run). |
| Migrations | Timestamp-prefixed SQL files + `applied_migrations` table (not sequential integers); timestamped file-copy backup before each migration | Sequential filenames collide across parallel worktree branches creating migrations independently. Backup makes a bad migration recoverable instead of a lost job search. |
| Dev loop | `electron-vite` (not hand-assembled Vite + nodemon + electron-reload) | Purpose-built for Electron: HMR for renderer, fast rebuild/auto-restart for main/preload, one config. Current de facto standard, actively maintained. |
| Filters | Structured rules engine (`saved_filters` table → SQL `WHERE` predicates), not LLM-first | Deterministic, debuggable via the activity log, zero API cost/hallucination risk, covers most filter needs without any model call. |
| LLM seam | `match_mode: 'exact' \| 'llm_assisted'` per filter criterion in the schema now; `llm_assisted` unimplemented until added | Same deferred-adapter pattern used for plugins/answer-bank/import — design the seam now, build the smarter implementation later without a schema rework. |
| Missing company data (size, sector) | `operations/enrich-company.ts`: input = company name, output = `{size, sector, source}` row in `companies`. v1 implementation = manual lookup by the owner; later = scraped/API; later still = LLM-assisted | Job boards/ATS providers don't expose company size/sector as structured fields — this can't be skipped, only staged. Same interface across all three implementation stages means later automation is a drop-in swap, not a rebuild. |
| Profile / future sync | `profile` table separate from session/credentials; per-platform import adapters map into a shared schema; each field carries `source` | Profile data *is* the answer-bank source. `source` per field leaves room for conflict resolution when platforms disagree, without building sync logic now. |
| Automated tests | Three narrow categories, not skipped: migrations run forward on a fixture DB, `saved_filters` produce the expected result set, IPC contract round-trips. Sourced from each issue's own acceptance criteria, not a separate test-writing effort | Targets exactly the deterministic-logic gap that matters given the owner doesn't read diffs (filters, migrations, IPC), without attempting to unit-test the inherently flaky browser-automation layer — that stays verified via dry-run. |
| Git workflow | Worktrees per branch/feature instead of branch-switching, each running its own live Electron instance | No lost running state when switching work. Requires instance-scoped `userData` path, SQLite file, dev port, and view partition names (all keyed off the same `instanceId`) so parallel instances don't share sessions or DB. Only one worktree may run `live` mode against real accounts at a time. |

## 5. Feature inventory — v0.1 status

**LinkedIn (built):** login check, applied-count fetch, recent-applied-jobs scrape, job-detail capture, Easy Apply job-card scan, Easy Apply modal fill (dry-run/live).
**Naukri (built):** login check, applied-count fetch.
**Not yet built, in scope for v0.1:** LinkedIn discovery scan → review → save/blacklist company → apply, wired together as one reviewable journey in the dashboard UI (currently these exist as separate IPC actions, not a connected flow).

ATS discovery (Lever et al.) was built and then **removed** 2026-09-12 as part of the complexity cut — see §13. Everything else from the original scripts inventory (connect, find-insiders, find-hiring-posts, ask-referral) is deferred past v0.1 — see §13.

## 6. Build order (v0.1)

0. ~~Dev loop~~ / ~~bare CDP proof~~ / ~~LinkedIn+Naukri session adapters~~ — done.
1. **Current focus:** connect LinkedIn discovery scan → review list → save/blacklist company → apply into one working dashboard journey, verified in the running app end to end.
2. Job tracker view with the applied-count chart and run-log panel — already scaffolded, keep it in sync with the journey above.
3. Only after that journey is solid and dogfooded: revisit anything in §13 (a second adapter, scheduling, rate limiting) based on real need, not the original speculative order.

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

Automation whose output is hidden from the user is rejected outright, not deferred — everything else non-essential to the v0.1 journey is deferred; see §13 for the full list (ATS/discovery adapters, scheduler, rate-limit ledger, LLM assistance, plugin marketplace, answer-bank UI, dual-account policy, Windows-98 UI kit).

## 9. Naming

Finalized: **Bojeno** (wordplay on "one job"). Used from here on for repo, docs, and all future references.

## 10. Repo setup

New repo, new pseudonym GitHub account, zero personal data from commit 1. Do not fork/branch from the `afterq` repo — its history (real name in commits, existing scripts) must never share a git log with the public project. This brief itself is the seed doc for that new repo's first Claude Code session.

## 11. Planning status and next steps

*This is the living, implementation-facing register. Keep it updated as a decision is made, work begins, completes, or is deliberately deferred. Do not create a competing next-steps document: this brief is the source of truth. Rewritten 2026-09-12 — the previous version of this section (36 numbered planning items) had accumulated faster than actual features shipped; most of it is now superseded by either completed work or the §13 deferred list. Don't refill this section with speculative multi-step plans again — keep it to what's actually in progress.*

**Done:** dev loop, LinkedIn/Naukri session adapters (login, applied count, recent-applied scrape, job-detail capture, Easy Apply scan + fill), SQLite schema for run logs/applied counts/applied jobs/apply attempts/company blacklist, dashboard shell with status bar + browser pane + log panel, `npm run check`/`devcheck`.

**In progress / next:** wire LinkedIn discovery scan → review → save/blacklist company → apply into one connected dashboard journey (§6). This is the only active work item — everything else is deferred (§13) until this journey is dogfooded and solid.

## 12. Reference repos

Before building a new adapter or discovery feature from scratch, check whether one of these already solved it — port/adapt rather than re-derive (see memory: prefer porting proven scripts/OSS tools over new architecture). Add to this list as new ones get consulted.

| Repo | What it's useful for |
|---|---|
| `C:\Users\i\afterq\tools` (local, private) | The original monolithic scripts this whole project ports from — LinkedIn/Naukri automation, `providers/{lever,ashby,...}.mjs` for ATS fetch logic. First place to check for any new adapter. |
| `C:\Users\i\afterq\career-ops` (local, private) | A more mature/structured sibling project — worth diffing against for patterns (e.g. eligibility/filter logic) before designing new Bojeno subsystems. |
| [colophon-group/jobseek](https://github.com/colophon-group/jobseek) (`apps/crawler/src/core/monitors/lever.py` etc.) | External OSS reference for ATS monitor implementations (Lever and others) — useful for cross-checking edge cases the local scripts don't cover. |

The Lever adapter itself (originally #18) was removed 2026-09-12 in the complexity cut below — this row stays as a pointer back to `lever.mjs` for whenever a second adapter is actually built.

Specific files worth knowing about ahead of time, found while scoping company-info/email/poster capture (2026-09-12):

| File | Capability | Bojeno status |
|---|---|---|
| `tools/find-company-id.mjs` | Resolves a company's numeric LinkedIn ID by searching for it, then regexing the company page's own HTML (`currentCompany=`, `urn:li:company:` patterns) | Not ported — being adapted now for a job-posting-to-company-id resolver |
| `tools/find-hiring-posts.mjs` | `EMAIL_RE` + a junk-filter list, scoped to LinkedIn feed post text | Not ported — being adapted now for JD-text email/phone extraction |
| `tools/find-insiders.mjs` | Finds 1st/2nd-degree connections at a target company (by numeric ID) for warm-intro/no-quota messaging | Not ported, no current plan to — flagged here so a future connections feature doesn't get re-derived from scratch |
| `tools/draft-hiring-leads.mjs`, `tools/filter-hiring-leads.mjs` | Turns `find-hiring-posts.mjs`'s raw email leads into filtered, drafted outreach | Not ported, no current plan to |
| `tools/ats_discover.py` | Discovers which ATS (Lever/Ashby/etc.) a company uses from its careers page | Not ported — relevant if a second adapter beyond LinkedIn/Naukri is ever built |

## 13. Deferred past v0.1

*Cut 2026-09-12: four sessions had built a scheduler, a rate-limit ledger, a capability-based adapter registry, and a full Lever ATS adapter (discovery + apply) before the single core user journey — LinkedIn discover → review → apply → track — was working end-to-end in the running app. All of it was real, tested, working code; none of it was earning its place yet. It was deleted outright (not just stopped) rather than left inert in the tree, on the theory that git history is the archive and a smaller, more honest tree is worth more right now than optionality that isn't needed yet. Re-read the relevant commit (before 77131ad / around 0a40366, c5ecbff) if any of this needs to come back — porting proven code is still preferred over re-deriving it from scratch (see memory: prefer porting/gluing over new architecture).*

Nothing below is scheduled. Each item comes back only when a real feature need forces it, not on a timeline:

- **ATS/discovery adapters** (Lever, Ashby, Greenhouse, SmartRecruiters, Workday) and the `kind: 'session' | 'api'` capability-based `Adapter` split that supported having more than one adapter shape. Re-add the split only when a second, structurally different adapter is actually being built.
- **Rate-limit ledger** (`action_budget` table, rolling-window per-platform/action-type budget). Add when a scheduler or any unattended/high-volume action actually exists to make an implicit pace risky.
- **Scheduler + circuit breaker** (user-defined cron entries, auto-disable after N consecutive failures) and the **kill switch** that was scoped to guard it. None of these have a caller yet — the app has no unattended runs to schedule or kill.
- **Canonical `jobs`/`companies` merge tables** (`job_sources`, `company_identifiers`, cross-source dedupe/unmerge). Current flat per-source tables (`applied_jobs`, `company_blacklist`) are good enough until a real cross-platform duplicate problem shows up.
- **`profile` table / answer-bank as its own schema object with per-field `source` provenance.** Answer bank currently lives as local config (`main/config/answerBank.ts`), which is enough for one user on one machine.
- **`saved_filters` with `match_mode: 'exact' | 'llm_assisted'`**, and any LLM-assisted filtering/enrichment/planning. Deterministic-only until the manual flow is dependable.
- **Company size/sector enrichment** (`operations/enrich-company.ts` seam).
- **Dual-account policy / test-account gating** for live-mode rollout of a new feature.
- **Windows-98 UI kit / custom design system.** Current UI is plain, functional React — revisit visual identity once the app does something worth making pretty.
- **Public plugin/extension marketplace**, MCP/CLI surfacing of the internal command API, packaging (`electron-builder`).
- **`selectors:healthcheck` diagnostic command.**
