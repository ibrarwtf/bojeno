import type { DatabaseSync } from 'node:sqlite'
import type { CompanyAboutInfo } from '../../../shared/types'

/**
 * Upserts a company row - keyed by `linkedin_company_id` when the id
 * resolution actually found one (the common case), falling back to a match
 * on `url` when it didn't (extractCompanyIdFromHtml can return null if the
 * page's html carries none of the known id patterns), so a company visited
 * twice without a resolvable id still updates its one row instead of
 * accumulating duplicates.
 */
export function upsertCompany(db: DatabaseSync, info: CompanyAboutInfo): void {
  const fetchedAt = new Date().toISOString()

  if (info.linkedinCompanyId) {
    db.prepare(
      `INSERT INTO companies
        (linkedin_company_id, name, url, website, industry, company_size, founded, specialties, overview, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(linkedin_company_id) DO UPDATE SET
         name = excluded.name,
         url = excluded.url,
         website = excluded.website,
         industry = excluded.industry,
         company_size = excluded.company_size,
         founded = excluded.founded,
         specialties = excluded.specialties,
         overview = excluded.overview,
         fetched_at = excluded.fetched_at`
    ).run(
      info.linkedinCompanyId,
      info.name,
      info.url,
      info.website,
      info.industry,
      info.companySize,
      info.founded,
      info.specialties,
      info.overview,
      fetchedAt
    )
    return
  }

  const existing = db.prepare('SELECT id FROM companies WHERE url = ?').get(info.url) as
    { id: number } | undefined

  if (existing) {
    db.prepare(
      `UPDATE companies SET
         name = ?, website = ?, industry = ?, company_size = ?, founded = ?, specialties = ?, overview = ?, fetched_at = ?
       WHERE id = ?`
    ).run(
      info.name,
      info.website,
      info.industry,
      info.companySize,
      info.founded,
      info.specialties,
      info.overview,
      fetchedAt,
      existing.id
    )
    return
  }

  db.prepare(
    `INSERT INTO companies
      (linkedin_company_id, name, url, website, industry, company_size, founded, specialties, overview, fetched_at)
     VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    info.name,
    info.url,
    info.website,
    info.industry,
    info.companySize,
    info.founded,
    info.specialties,
    info.overview,
    fetchedAt
  )
}

/** Read helper for verification/inspection - not currently wired into any UI. */
export function getCompanyByLinkedinId(
  db: DatabaseSync,
  linkedinCompanyId: string
): (CompanyAboutInfo & { fetchedAt: string }) | undefined {
  const row = db
    .prepare(
      `SELECT linkedin_company_id as linkedinCompanyId, name, url, website, industry,
              company_size as companySize, founded, specialties, overview, fetched_at as fetchedAt
       FROM companies WHERE linkedin_company_id = ?`
    )
    .get(linkedinCompanyId) as (CompanyAboutInfo & { fetchedAt: string }) | undefined
  return row
}
