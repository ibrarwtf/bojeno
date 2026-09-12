import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // .claude/worktrees holds other agents' isolated git worktree checkouts,
    // nested under this repo root - vitest's own default excludes don't
    // cover it (only .git/.cache/.output/.temp), so without this a run here
    // also executes whatever's checked out in a concurrent worktree,
    // doubling the reported test count and letting that branch's failures
    // fail this one's own `npm run check`.
    exclude: ['**/node_modules/**', '**/dist/**', '**/out/**', '.claude/worktrees/**']
  }
})
