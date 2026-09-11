import type { DatabaseSync } from 'node:sqlite'

export interface Migration {
  id: string
  sql: string
}

export function ensureMigrationsTable(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS applied_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `)
}

function getAppliedIds(db: DatabaseSync): Set<string> {
  const rows = db.prepare('SELECT id FROM applied_migrations').all() as { id: string }[]
  return new Set(rows.map((row) => row.id))
}

/**
 * Applies any migrations not yet recorded in applied_migrations, in id
 * (timestamp-prefixed filename) order. `backup` is called once per migration,
 * before that migration runs — not once per call — so a bad migration among
 * several pending ones still leaves a recovery point for the ones before it.
 */
export function runMigrations(
  db: DatabaseSync,
  migrations: Migration[],
  backup: () => void
): string[] {
  ensureMigrationsTable(db)
  const applied = getAppliedIds(db)
  const pending = [...migrations].sort((a, b) => a.id.localeCompare(b.id))

  const newlyApplied: string[] = []
  for (const migration of pending) {
    if (applied.has(migration.id)) continue
    backup()
    db.exec(migration.sql)
    db.prepare('INSERT INTO applied_migrations (id, applied_at) VALUES (?, ?)').run(
      migration.id,
      new Date().toISOString()
    )
    newlyApplied.push(migration.id)
  }
  return newlyApplied
}
