# Bojeno — Claude Code guide

Read [`bojeno-project-brief.md`](./bojeno-project-brief.md) first — it's the seed doc with the architecture and decisions, kept up to date as they change (see its §4 note on `node:sqlite` for an example of a decision that changed after the brief was written). This file is process/gotchas, not architecture.

## Commands

```bash
npm run dev         # electron-vite dev --watch — watch requires the flag, see gotchas below
npm run typecheck   # tsc, strict, both main and renderer
npm run lint        # eslint --cache
npm run format      # prettier --write . — bojeno-project-brief.md is excluded, don't remove that exclusion
npm run test        # vitest run
```

Run `typecheck`, `lint`, and `test` before every commit — not just the one that seems relevant to the change.

## Verify against the real running app, not just green checks

A passing `typecheck`/`lint`/`test` run proves the code compiles and the pure logic is right. It proves nothing about whether a selector actually matches, whether a login-check actually detects a real session, or whether a chart actually renders with real data. Every feature in this repo so far was verified by starting `npm run dev`, then either driving it directly (CDP via `playwright-core`, or the in-app browser tool) or asking the owner to use it — not by reading the diff. Several real bugs (wrong selectors, a login-check that reported a real session as logged out, a race condition StrictMode exposed) were caught this way and would not have been caught by typecheck/lint/tests alone.

When inspecting a real logged-in page to write a selector, **inspect it live first** (via the browser tool, or a small `page.evaluate()` script) — don't guess a selector from a screenshot or a hunch and hope it's stable. LinkedIn ships hashed/obfuscated class names throughout (confirmed repeatedly); Naukri sometimes has real semantic ones. You won't know which until you look.

## Concurrency: adapter actions that navigate must be serialized

Any adapter method that calls `page.goto()`/navigates a `WebContentsView` must go through `withLock(platform, ...)` (`src/main/lock.ts`) in its IPC handler. Two concurrent calls against the same page's navigation race each other into `net::ERR_ABORTED` — this isn't hypothetical, it's exactly what React StrictMode's dev-mode double-invoke exposed for `checkLogin`, and it would happen for real if a user double-clicked a fetch button. The lock is cheap (a tiny per-id promise chain); skipping it for a "quick" new action will eventually produce an intermittent, hard-to-repro bug.

## Login/selector detection: prefer root-URL redirect over deep-linking

Both `checkLogin` implementations navigate to the platform's **root URL** and check where it lands (`waitForPathname` in `cdp.ts`), rather than deep-linking to a gated page and inferring state from an inverse condition. It's simpler and it's what actually happens when a real user opens the site. If a redirect is delayed/client-side (Naukri does this), give `waitForPathname` a generous timeout rather than trying to detect an intermediate DOM state — a flaky 6s timeout once produced a false "logged out" for a real, verified-logged-in session; the fix was widening the timeout, not adding cleverness.

## Line endings

`.gitattributes` normalizes everything to LF. If you ever see a wall of `Delete ␍` prettier warnings across files you didn't touch, something bypassed `.gitattributes` (e.g. a raw `git apply` or a tool that ignores it) — don't chase each warning individually, just run `npm run format` once and move on; it's cosmetic, not a real defect.

## Branch hygiene

If you open a PR, then start a second feature branch off `master` before the first merges, and the first merges while you're still working — rebase the second branch onto the new `master` and resolve conflicts _before_ asking to merge it, rather than letting the merge attempt discover the conflict. `shared/ipc-contract.ts`, `shared/types.ts`, `preload/index.ts`, and `Dashboard.tsx` are touched by nearly every feature and are the most likely conflict points; they're usually trivial import-list conflicts, not real logic conflicts, once you look.

## Scratch/diagnostic scripts

Never leave throwaway `.cjs`/`.mjs` inspection or CDP-test scripts in the repo root — delete them before staging, every time (`git status --porcelain` before `git add` is the check). They're useful for verifying a feature works but they're not part of the codebase.
