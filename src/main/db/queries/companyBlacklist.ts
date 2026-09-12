import type { DatabaseSync } from 'node:sqlite'

/** Case-insensitive exact match on the trimmed company name - returns the
 *  stored reason (if any) so callers can surface *why*, not just that a
 *  company is blacklisted. */
export function blacklistReason(db: DatabaseSync, companyName: string): string | undefined {
  const row = db
    .prepare(
      'SELECT reason FROM company_blacklist WHERE lower(trim(company_name)) = lower(trim(?))'
    )
    .get(companyName) as { reason: string | null } | undefined
  return row?.reason ?? undefined
}

export function isCompanyBlacklisted(db: DatabaseSync, companyName: string): boolean {
  const row = db
    .prepare('SELECT 1 FROM company_blacklist WHERE lower(trim(company_name)) = lower(trim(?))')
    .get(companyName)
  return row !== undefined
}

export function addToBlacklist(db: DatabaseSync, companyName: string, reason?: string): void {
  db.prepare(
    'INSERT OR IGNORE INTO company_blacklist (company_name, added_at, reason) VALUES (?, ?, ?)'
  ).run(companyName, new Date().toISOString(), reason ?? null)
}
