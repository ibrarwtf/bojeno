// One-time seed of the AI/ML engineer saved searches (#87): Hyderabad,
// India, Dubai, UAE, and Remote. Plain Node script, not part of the
// Electron app - writes directly to the same sqlite file the app uses,
// mirroring createSavedSearch in src/main/db/queries/linkedinSavedSearches.ts.
// Safe to re-run: skips any name that already exists instead of duplicating it.
//
// USAGE:
//   node scripts/seed-ai-engineer-searches.cjs
//   BOJENO_INSTANCE_ID=default node scripts/seed-ai-engineer-searches.cjs

const { DatabaseSync } = require('node:sqlite')
const path = require('node:path')
const os = require('node:os')

const instanceId = process.env.BOJENO_INSTANCE_ID || 'default'
const dbPath = path.join(
  os.homedir(),
  'AppData',
  'Roaming',
  'bojeno',
  `bojeno-${instanceId}.sqlite`
)

const REQUIRED_MIGRATION = '20260913T0000_saved_search_date_posted_and_workplace.sql'

// LinkedIn boolean keyword search - Engineer/Developer titles, AI/ML/Automation
// domain. Refine the NOT-exclusions once real scan results show noise.
const KEYWORDS =
  '("AI Engineer" OR "ML Engineer" OR "Machine Learning Engineer" OR "AI Developer" OR "ML Developer" OR "Automation Engineer") NOT (Sales OR Intern)'

// From src/main/adapters/linkedin/geoIds.ts (KNOWN_GEO_IDS).
const GEO_IDS = {
  hyderabad: '105556991',
  india: '102713980',
  dubai: '106204383',
  uae: '104305776'
}

const SHARED = {
  keywords: KEYWORDS,
  sortByRecent: true,
  easyApplyOnly: true,
  datePosted: 'pastWeek'
}

const SEARCHES = [
  { name: 'AI Engineer - Hyderabad', geoId: GEO_IDS.hyderabad, ...SHARED },
  { name: 'AI Engineer - India', geoId: GEO_IDS.india, ...SHARED },
  { name: 'AI Engineer - Dubai', geoId: GEO_IDS.dubai, ...SHARED },
  { name: 'AI Engineer - UAE', geoId: GEO_IDS.uae, ...SHARED },
  // No dedicated "Remote" geoId - India is the broadest existing base
  // location, narrowed to remote-only postings via workplaceTypes.
  { name: 'AI Engineer - Remote', geoId: GEO_IDS.india, workplaceTypes: ['remote'], ...SHARED }
]

function insertSavedSearch(db, search) {
  db.prepare(
    `INSERT INTO linkedin_saved_searches
      (name, keywords, location, geo_id, distance_km, sort_by_recent, easy_apply_only, date_posted, workplace_types, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    search.name,
    search.keywords ?? null,
    search.location ?? null,
    search.geoId ?? null,
    search.distanceKm ?? null,
    search.sortByRecent ? 1 : 0,
    search.easyApplyOnly ? 1 : 0,
    search.datePosted ?? null,
    search.workplaceTypes?.length ? JSON.stringify(search.workplaceTypes) : null,
    new Date().toISOString()
  )
}

function main() {
  const fs = require('node:fs')
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
      `Migration ${REQUIRED_MIGRATION} hasn't run against this database yet - start the app once (npm run dev) to apply it, then re-run this seed.`
    )
    process.exit(1)
  }

  let inserted = 0
  let skipped = 0

  for (const search of SEARCHES) {
    const existing = db
      .prepare('SELECT 1 FROM linkedin_saved_searches WHERE name = ?')
      .get(search.name)
    if (existing) {
      console.log(`Skipping "${search.name}" - already exists.`)
      skipped++
      continue
    }
    insertSavedSearch(db, search)
    console.log(`Inserted "${search.name}".`)
    inserted++
  }

  console.log(`\nDone: ${inserted} inserted, ${skipped} skipped.`)
}

main()
