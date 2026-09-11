/**
 * Scopes session partitions, so parallel branches/worktrees never share
 * cookies. No worktrees in use yet — fixed to 'default' until that changes.
 */
export const instanceId = process.env.BOJENO_INSTANCE_ID ?? 'default'
