import type { DatabaseSync } from 'node:sqlite'

/** Case-insensitive exact match on the trimmed company name. */
export function isCompanyBlacklisted(db: DatabaseSync, companyName: string): boolean {
  const row = db
    .prepare('SELECT 1 FROM company_blacklist WHERE lower(trim(company_name)) = lower(trim(?))')
    .get(companyName)
  return row !== undefined
}

export function addToBlacklist(db: DatabaseSync, companyName: string): void {
  db.prepare('INSERT OR IGNORE INTO company_blacklist (company_name, added_at) VALUES (?, ?)').run(
    companyName,
    new Date().toISOString()
  )
}
