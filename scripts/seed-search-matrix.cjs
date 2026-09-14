// One-time seed of the 3x3 location x keyword saved-search matrix: Hyderabad,
// India, and Dubai, each run with no keyword filter, "ai", and "data" - 9
// searches total, most of them expected to resurface the same postings
// across variants (that overlap is exactly what the run_logs job-id cache in
// runSequentialSearch's filterCard hook is for - see runLogs.ts's
// findLatestJobLog). Replaces the earlier 5-search Hyderabad/India/Dubai/
// UAE/Remote layout (#87) with a simpler, deliberately broader net: LinkedIn's
// own boolean keyword search is no longer relied on to find relevant titles -
// the app's own title filter (.local/preferences.json) does that instead, so
// a keyword-less search is worth running too.
//
// Plain Node script, not part of the Electron app - writes directly to the
// same sqlite file the app uses, mirroring createSavedSearch in
// src/main/db/queries/linkedinSavedSearches.ts. Safe to re-run: skips any
// name that already exists instead of duplicating it.
//
// USAGE:
//   node scripts/seed-search-matrix.cjs
//   BOJENO_INSTANCE_ID=default node scripts/seed-search-matrix.cjs

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

// From src/main/adapters/linkedin/geoIds.ts (KNOWN_GEO_IDS).
const GEO_IDS = {
  hyderabad: '105556991',
  india: '102713980',
  dubai: '106204383'
}

const KEYWORD_VARIANTS = [
  { label: 'All', keywords: undefined },
  { label: 'AI', keywords: 'ai' },
  { label: 'Data', keywords: 'data' }
]

const SHARED = {
  sortByRecent: true,
  easyApplyOnly: true,
  datePosted: 'pastWeek'
}

const SEARCHES = Object.entries(GEO_IDS).flatMap(([place, geoId]) =>
  KEYWORD_VARIANTS.map((variant) => ({
    name: `${place[0].toUpperCase()}${place.slice(1)} - ${variant.label}`,
    geoId,
    keywords: variant.keywords,
    ...SHARED
  }))
)

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
