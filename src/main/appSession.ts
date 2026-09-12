/**
 * Set once, the first time this module is imported (at app startup) - used
 * to scope the live log panel to the current run of the app, without
 * deleting or filtering the underlying run_logs history itself. Nothing
 * pulled from the DB before this timestamp shows up in the panel, but it's
 * all still there for anyone querying the DB directly.
 */
export const appSessionStartedAt = new Date().toISOString()
