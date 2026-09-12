// One-time import of the GCC company-research dataset
// (C:\Users\i\afterq\companies-location-role-finder - local, private, not
// part of this repo) into bojeno's own `companies` table. This is a plain
// Node script, not part of the Electron app - it writes directly to the
// same sqlite file the app uses, mirroring
// src/main/db/queries/companies.ts's upsertGccCompanyImport SQL (kept in
// sync by hand; that function's own doc comment explains the merge
// semantics - shared fields COALESCE so this never clobbers a value a real
// apply-time /about scrape already resolved).
//
// USAGE:
//   node scripts/import-gcc-companies.cjs
//   node scripts/import-gcc-companies.cjs "C:\path\to\companies-location-role-finder"
//   BOJENO_INSTANCE_ID=default node scripts/import-gcc-companies.cjs
//
// Only reads <slug>/<slug>.md company files - role files
// (<slug>/<slug>-<location>-<role>.md) are a different concept (per-posting
// leads, not company data) and out of scope for this import.

const { DatabaseSync } = require('node:sqlite')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')

const DEFAULT_SOURCE_DIR = 'C:\\Users\\i\\afterq\\companies-location-role-finder'
const sourceDir = process.argv[2] || DEFAULT_SOURCE_DIR

const instanceId = process.env.BOJENO_INSTANCE_ID || 'default'
const dbPath = path.join(
  os.homedir(),
  'AppData',
  'Roaming',
  'bojeno',
  `bojeno-${instanceId}.sqlite`
)

const REQUIRED_MIGRATION = '20260912T0900_companies_gcc_fields.sql'
const TODAY = new Date().toISOString().slice(0, 10)

/**
 * Minimal frontmatter parser for this dataset's own flat schema (see
 * companies-location-role-finder/README.md) - no nesting, values are either
 * a bare/quoted scalar or a single-level `[a, b]` array. Not a general YAML
 * parser; would need rework if the source format grows nested structures.
 */
function parseFrontmatter(content) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content)
  if (!match) return {}
  const data = {}
  for (const line of match[1].split(/\r?\n/)) {
    const m = /^([a-z_]+):\s*(.*)$/.exec(line)
    if (!m) continue
    const key = m[1]
    let value = m[2].trim()
    if (value.startsWith('[') && value.endsWith(']')) {
      const inner = value.slice(1, -1).trim()
      data[key] = inner ? inner.split(',').map((s) => s.trim()) : []
      continue
    }
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    data[key] = value
  }
  return data
}

function upsertGccCompany(db, row) {
  const fetchedAt = new Date().toISOString()
  const indiaCitiesJson =
    row.indiaCities && row.indiaCities.length ? JSON.stringify(row.indiaCities) : null
  const url = row.linkedinCompanyId
    ? `https://www.linkedin.com/company/${row.linkedinCompanyId}/`
    : null

  const existing = row.linkedinCompanyId
    ? db
        .prepare('SELECT id FROM companies WHERE linkedin_company_id = ?')
        .get(row.linkedinCompanyId)
    : db.prepare('SELECT id FROM companies WHERE name = ?').get(row.name)

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
    return 'updated'
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
  return 'inserted'
}

function main() {
  if (!fs.existsSync(sourceDir)) {
    console.error(`Source directory not found: ${sourceDir}`)
    process.exit(1)
  }
  if (!fs.existsSync(dbPath)) {
    console.error(`Bojeno database not found at ${dbPath} - run the app at least once first.`)
    process.exit(1)
  }

  const db = new DatabaseSync(dbPath)

  const applied = db
    .prepare('SELECT 1 FROM applied_migrations WHERE id = ?')
    .get(REQUIRED_MIGRATION)
  if (!applied) {
    console.error(
      `Migration ${REQUIRED_MIGRATION} hasn't run against this database yet - start the app once (npm run dev) to apply it, then re-run this import.`
    )
    process.exit(1)
  }

  const slugs = fs
    .readdirSync(sourceDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)

  let inserted = 0
  let updated = 0
  let skipped = 0

  for (const slug of slugs) {
    const companyFile = path.join(sourceDir, slug, `${slug}.md`)
    if (!fs.existsSync(companyFile)) {
      skipped++
      continue
    }
    const content = fs.readFileSync(companyFile, 'utf-8')
    const fm = parseFrontmatter(content)
    if (!fm.company) {
      skipped++
      continue
    }

    const row = {
      linkedinCompanyId: fm.linkedin_id || null,
      name: fm.company,
      hqCountry: fm.hq_country || null,
      industry: fm.sector || null,
      companySize: fm.size_band || null,
      overview: fm.focus || null,
      indiaCities: Array.isArray(fm.india_cities) ? fm.india_cities : null,
      careersUrl: fm.careers_url || null,
      ats: fm.ats && fm.ats !== 'unknown' ? fm.ats : null,
      status: fm.status || null,
      skipReason: fm.skip_reason || null,
      remark: `GCC imported from file at ${TODAY}`
    }

    const result = upsertGccCompany(db, row)
    if (result === 'inserted') inserted++
    else updated++
  }

  console.log(`Imported from ${sourceDir}:`)
  console.log(`  inserted: ${inserted}`)
  console.log(`  updated:  ${updated}`)
  console.log(`  skipped:  ${skipped} (no <slug>.md file or no company name found)`)
}

main()
