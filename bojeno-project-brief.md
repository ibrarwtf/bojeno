# Bojeno — Vision & Direction (rewritten 2026-09-13)

*Local-first job-search automation desktop app. This document is the seed input for Claude Code sessions — kept up to date as decisions change, same as before. It supersedes the original planning doc (v2, 2026-09-11/12): that version was written before a single line of code existed; this version reflects two days of real building, a deliberate complexity cut, and a direct conversation about what the owner actually needs. Treat this as the source of truth going forward — the old brief's content lives on in git history if a past decision's original reasoning needs re-reading.*

---

## 1. The actual goal (read this before anything else)

The owner needs a job, soon. Building Bojeno is not the goal — it is a lever for the goal. The product's entire job is: **manufacture a steady pipeline of interviews while costing the owner as close to zero attention as possible**, so nearly all of his time goes to interview prep, not to running or babysitting a tool.

The framing that follows from this: **fail late, not early.** Getting seen (applying, being relevant, being an early applicant) is the cheap, automatable part. Getting an interview and converting it is the part that actually needs the owner's time and skill. Optimize hard for volume and reach at the top of the funnel; don't spend effort building automation for stages that are inherently human (a phone call, an interview).

This reframes "v0.1 done" away from "a clean automation platform" and toward: **a background process that keeps applying, tells the owner only when it's actually stuck, and gives him the data to see which levers move his interview rate.**

## 2. The funnel — what we're actually optimizing

Five stages. Only the first is fully automatable today; the rest are tracked, not automated, and that's fine — the point of tracking them is to see where the real drop-off is before spending any engineering effort there.

| # | Stage | How it's captured | Metric |
|---|---|---|---|
| 1 | **Applied** | Automated (LinkedIn Easy Apply today; Naukri, others as they're built) | Applications/day, per platform |
| 2 | **Viewed** | Automated on LinkedIn — see §2a below | View rate = viewed / applied |
| 3 | **Contacted** (recruiter calls/messages) | Manual log — owner is in the app daily anyway | Contact rate = contacted / applied |
| 4 | **Interview scheduled** | Manual log now; Gmail-based auto-capture is a plausible later automation (owner uses one email for this) | Contact→interview rate; also drives follow-up reminders (no invite within N days of a contact → surfaced as a reminder) |
| 5 | **Interview outcome** | Manual log, entirely the owner's own work (prep, performance) | Interview→offer rate — tracked for pattern-spotting only, not something the tool influences |

The tool's job is to get the owner reliably to the top of stage 4. Stages 4 and 5 belong to the owner; Bojeno's role there is just to hold the data so patterns are visible (e.g. "which resume/targeting choices correlate with more views" or "which contacts go cold without follow-up").

### 2a. LinkedIn "viewed" is a solved data source, not a guess

LinkedIn's own notifications ("Your application to X was viewed") are a real, scrapeable signal — read the notifications page, parse the simple structured text, match back to the applied-job record. This is not a "best-effort, might not exist" data point as originally assumed; it's a real page to scrape like any other LinkedIn page in this app.

**Backfill, don't wait for it to accumulate:** the owner has ~4 weeks of real application history plus an existing LinkedIn data export. Both get imported as day-one historical rows rather than starting the funnel counters at zero:
- Data export → backfills `applied` rows for the past month without any scraping.
- Notifications-page scrape → backfills `viewed` rows against those same applications.

This is a concrete near-term task, not a someday item — it's what makes the funnel metrics meaningful from day one instead of needing a month to accumulate signal.

## 3. Attention model — batch, not real-time

Not "alert only on catastrophic failure." Anything needing a decision (an unmatched screening question, a login expiry, a budget hit) is written to the existing "needs review" queue and fires a notification. The owner acts on it whenever convenient — often while doing something else on another tab — and clears the queue in batches, not one at a time in real time.

- If he acts within a short window after the notification, the run continues immediately.
- If he doesn't, the item just sits in the review queue — nothing is lost, nothing blocks, it gets picked up whenever he next checks in.
- Cross-device push (Windows + phone) is a real want, but explicitly later — native desktop notification tied to the existing review queue is the v1 version of this.

## 4. Scheduling — simple, with priority windows

A flat "run every N hours" scheduler is the wrong shape. Fresh postings and early-applicant advantage matter, so:
- **Peak windows** (e.g. 9–11am, 2–5pm — fresh postings, higher response likelihood): check roughly hourly.
- **Off-peak**: check less frequently.
- **Manual "run now"** always available regardless of the schedule — this doesn't replace manual triggering, it supplements it.

Keep this simple: a small config of windows + intervals, not a general-purpose cron/rule engine.

## 5. Safety — logging first, caps later, no circuit breaker yet

- The existing pause/play control is the stop mechanism. No auto-disable-on-N-failures circuit breaker — not needed while applications stay targeted/relevant rather than bulk.
- A usage ledger (every action logged with enough detail to compute rate) ships now, **as logging only** — no enforcement yet.
- Once there's enough real logged data to know what a safe per-platform pace actually looks like, add a hard per-window cap that pauses further applies until the next window. Don't guess a number now; derive it from what's actually being logged.

## 6. Reuse-first workflow (new default for all new work)

Two days of building revealed the cost of designing from scratch what already exists as OSS. New default sequence for any new capability (a platform adapter, a scraper, a scheduler, anything):

1. Search GitHub for existing projects solving this.
2. Read/understand the strongest candidates.
3. Small prototype against the real target (a LinkedIn/Naukri page, a real DB, etc.).
4. Whatever works: adopt directly with minimal glue, or fork and edit if it's close but not exact.

Caveat: most public "auto-apply" repos follow the AIHawk-style spam-bot pattern this project explicitly isn't (see §8) — pull the useful *pieces* (selector strategies, ATS-detection logic, form-fill helpers) rather than adopting one whole-hog, since their volume/pacing assumptions won't match a single real account used carefully. License/attribution diligence is deferred until anything is published beyond personal use — this is a personal tool right now, that concern doesn't block building.

## 7. Platform order

1. **LinkedIn** — already has login, applied-count, recent-applied scrape, JD capture, Easy Apply scan + fill, view-tracking (§2a).
2. **Naukri** — currently login + applied-count only; bring apply-flow to parity next, applying the reuse-first workflow (§6).
3. **Other platforms** (Lever, Ashby, Greenhouse, etc.) — after 1 and 2, each following §6. Lever was built once and deliberately deleted during the Sep-12 complexity cut (commits around `0a40366`/`77131ad`) — port it back from git history rather than rebuilding, when its turn comes.

More platforms = more surface area = more chances at a callback. This is worth doing, just sequenced behind making the first two solid, not parallel to them.

## 8. Non-negotiables carried forward from the original brief

These predate the pivot and still hold:
- Not an "auto-apply to 1000 jobs" spam bot. Targeted, relevant applications only — volume comes from more platforms and fresher postings, not from lowering the relevance bar.
- Fully visible automation only — nothing the owner can't see in logs/dashboard after the fact. ("Visible" now explicitly includes runs that happen while he's not watching in real time — see §3 — as long as the record is complete.)
- Local-first, BYOA/BYOK — logins, data, any LLM key stay on the owner's machine. Laptop-only; no server/remote deployment in scope.
- TypeScript everywhere, strict mode — the compiler is still the review layer for a solo dev who verifies behaviorally, not by reading diffs.

## 9. Data model implication

The funnel/CRM tracking (contacted, interview scheduled, follow-up reminders) is **one more table behind the CRUD the app already has** — not a new subsystem, not a "build a CRM" project. Same pattern as every other table in this app.

## 10. Immediate next steps (in order)

1. Wire a native OS notification to the existing "needs review" queue.
2. Backfill LinkedIn `applied` history from the owner's data export, and `viewed` status from scraping the notifications page (§2a) — do this before/alongside other work so the funnel has real historical signal immediately.
3. Priority-window scheduler (§4).
4. Usage ledger, logging-only (§5).
5. Funnel/CRM table: contacted / interview-scheduled logging + follow-up reminders.
6. Naukri apply-flow parity (§7).
7. Next platform, reuse-first (§6, §7).

## 11. What's still deferred, and why

Unchanged from the original complexity-cut reasoning — still no real caller for these:
- Circuit breaker / auto-disable-on-failure (kill switch beyond pause/play).
- Capability-based `Adapter` registry (`kind: 'session' | 'api'` split) — re-add only when a structurally different adapter is actually being built.
- Canonical `jobs`/`companies` merge tables, cross-source dedupe.
- LLM-assisted filtering/enrichment/planning.
- Packaging (`electron-builder`) — laptop-only, dev-mode running is sufficient until the core flow is fully proven.
- Public plugin/extension marketplace.

---

*Architecture, schema, and per-decision rationale (Electron/WebContentsView/CDP, SQLite via `node:sqlite`, IPC contract, adapter interface, migrations, git workflow) are unchanged from the original brief and still accurate — see git history (`bojeno-project-brief.md` as of commit `baba5ba` and later) for the full detail. This document only replaces the vision, priorities, and near-term plan.*
