import type { DatabaseSync } from 'node:sqlite'
import type { LinkedinSavedSearch } from '../../../shared/types'

interface SavedSearchRow {
  id: number
  name: string
  keywords: string | null
  location: string | null
  geo_id: string | null
  distance_km: number | null
  sort_by_recent: number
  easy_apply_only: number
  created_at: string
  last_run_at: string | null
}

function toSavedSearch(row: SavedSearchRow): LinkedinSavedSearch {
  return {
    id: row.id,
    name: row.name,
    keywords: row.keywords,
    location: row.location,
    geoId: row.geo_id,
    distanceKm: row.distance_km,
    sortByRecent: row.sort_by_recent === 1,
    easyApplyOnly: row.easy_apply_only === 1,
    createdAt: row.created_at,
    lastRunAt: row.last_run_at
  }
}

const SELECT_COLUMNS =
  'id, name, keywords, location, geo_id, distance_km, sort_by_recent, easy_apply_only, created_at, last_run_at'

/** Most recently created first. */
export function listSavedSearches(db: DatabaseSync): LinkedinSavedSearch[] {
  const rows = db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM linkedin_saved_searches ORDER BY id DESC`)
    .all() as unknown as SavedSearchRow[]
  return rows.map(toSavedSearch)
}

export interface CreateSavedSearchArgs {
  name: string
  keywords?: string
  location?: string
  geoId?: string
  distanceKm?: number
  sortByRecent?: boolean
  easyApplyOnly?: boolean
}

export function createSavedSearch(
  db: DatabaseSync,
  args: CreateSavedSearchArgs
): LinkedinSavedSearch {
  const result = db
    .prepare(
      `INSERT INTO linkedin_saved_searches
        (name, keywords, location, geo_id, distance_km, sort_by_recent, easy_apply_only, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      args.name,
      args.keywords ?? null,
      args.location ?? null,
      args.geoId ?? null,
      args.distanceKm ?? null,
      args.sortByRecent ? 1 : 0,
      args.easyApplyOnly ? 1 : 0,
      new Date().toISOString()
    )
  const row = db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM linkedin_saved_searches WHERE id = ?`)
    .get(result.lastInsertRowid) as unknown as SavedSearchRow
  return toSavedSearch(row)
}

export function deleteSavedSearch(db: DatabaseSync, id: number): void {
  db.prepare('DELETE FROM linkedin_saved_searches WHERE id = ?').run(id)
}

export function touchSavedSearchLastRun(db: DatabaseSync, id: number): void {
  db.prepare('UPDATE linkedin_saved_searches SET last_run_at = ? WHERE id = ?').run(
    new Date().toISOString(),
    id
  )
}
