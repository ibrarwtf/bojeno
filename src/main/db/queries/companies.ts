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

const SELECT_COLUMNS = `
  linkedin_company_id as linkedinCompanyId, name, url, website, industry,
  company_size as companySize, founded, specialties, overview,
  hq_country as hqCountry, india_cities as indiaCitiesRaw, careers_url as careersUrl,
  ats, status, skip_reason as skipReason, remark, fetched_at as fetchedAt
`

interface CompanyRowRaw {
  linkedinCompanyId: string | null
  name: string | null
  url: string | null
  website: string | null
  industry: string | null
  companySize: string | null
  founded: string | null
  specialties: string | null
  overview: string | null
  hqCountry: string | null
  /** JSON-encoded in the DB (see india_cities column comment) - parsed here, not left to callers. */
  indiaCitiesRaw: string | null
  careersUrl: string | null
  ats: string | null
  status: string | null
  skipReason: string | null
  remark: string | null
  fetchedAt: string
}

function toCompanyRow(row: CompanyRowRaw): CompanyAboutInfo & { fetchedAt: string } {
  const { indiaCitiesRaw, ...rest } = row
  let indiaCities: string[] | null = null
  if (indiaCitiesRaw) {
    try {
      indiaCities = JSON.parse(indiaCitiesRaw) as string[]
    } catch {
      indiaCities = null
    }
  }
  return { ...rest, indiaCities }
}

/** Read helper for verification/inspection - not currently wired into any UI. */
export function getCompanyByLinkedinId(
  db: DatabaseSync,
  linkedinCompanyId: string
): (CompanyAboutInfo & { fetchedAt: string }) | undefined {
  const row = db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM companies WHERE linkedin_company_id = ?`)
    .get(linkedinCompanyId) as CompanyRowRaw | undefined
  return row ? toCompanyRow(row) : undefined
}

/** Same lookup keyed by exact company name - used by the GCC import for
 *  companies with no resolvable linkedin_company_id. */
export function getCompanyByName(
  db: DatabaseSync,
  name: string
): (CompanyAboutInfo & { fetchedAt: string }) | undefined {
  const row = db.prepare(`SELECT ${SELECT_COLUMNS} FROM companies WHERE name = ?`).get(name) as
    CompanyRowRaw | undefined
  return row ? toCompanyRow(row) : undefined
}

export interface GccCompanyImportRow {
  linkedinCompanyId: string | null
  name: string
  hqCountry: string | null
  industry: string | null
  companySize: string | null
  overview: string | null
  indiaCities: string[] | null
  careersUrl: string | null
  ats: string | null
  status: string | null
  skipReason: string | null
  /** Provenance note, e.g. "GCC imported from file at 2026-09-12" - always set by this importer. */
  remark: string
}

/**
 * Upserts a company row from the GCC research import
 * (scripts/import-gcc-companies.cjs) - keyed by `linkedin_company_id` when
 * the source file already had one resolved (the common case for ~40% of
 * that dataset), falling back to an exact `name` match otherwise. Shared
 * fields (industry/company_size/overview/url) use COALESCE so this never
 * clobbers a value a real apply-time /about scrape already resolved -
 * import-only fields (hq_country/india_cities/careers_url/ats/status/
 * skip_reason/remark) always take the import's value, since nothing else
 * writes them.
 */
export function upsertGccCompanyImport(db: DatabaseSync, row: GccCompanyImportRow): void {
  const fetchedAt = new Date().toISOString()
  const indiaCitiesJson = row.indiaCities ? JSON.stringify(row.indiaCities) : null
  const url = row.linkedinCompanyId
    ? `https://www.linkedin.com/company/${row.linkedinCompanyId}/`
    : null

  const existing = (
    row.linkedinCompanyId
      ? db
          .prepare('SELECT id FROM companies WHERE linkedin_company_id = ?')
          .get(row.linkedinCompanyId)
      : db.prepare('SELECT id FROM companies WHERE name = ?').get(row.name)
  ) as { id: number } | undefined

  if (existing) {
    db.prepare(
      `UPDATE companies SET
         linkedin_company_id = COALESCE(linkedin_company_id, ?),
         name = ?,
         url = COALESCE(url, ?),
         industry = COALESCE(industry, ?),
         company_size = COALESCE(company_size, ?),
         overview = COALESCE(overview, ?),
         hq_country = ?,
         india_cities = ?,
         careers_url = ?,
         ats = ?,
         status = ?,
         skip_reason = ?,
         remark = ?,
         fetched_at = ?
       WHERE id = ?`
    ).run(
      row.linkedinCompanyId,
      row.name,
      url,
      row.industry,
      row.companySize,
      row.overview,
      row.hqCountry,
      indiaCitiesJson,
      row.careersUrl,
      row.ats,
      row.status,
      row.skipReason,
      row.remark,
      fetchedAt,
      existing.id
    )
    return
  }

  db.prepare(
    `INSERT INTO companies
      (linkedin_company_id, name, url, industry, company_size, overview,
       hq_country, india_cities, careers_url, ats, status, skip_reason, remark, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    row.linkedinCompanyId,
    row.name,
    url,
    row.industry,
    row.companySize,
    row.overview,
    row.hqCountry,
    indiaCitiesJson,
    row.careersUrl,
    row.ats,
    row.status,
    row.skipReason,
    row.remark,
    fetchedAt
  )
}
