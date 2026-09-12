import { describe, it, expect } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { runMigrations, type Migration } from '../migrate'
import initMigrationSql from '../migrations/20260911T1900_init.sql?raw'
import pipelineContactsSql from '../migrations/20260912T1100_pipeline_contacts.sql?raw'
import {
  deletePipelineContact,
  getPipelineContact,
  insertPipelineContact,
  listFollowUpsDue,
  listPipelineContacts,
  updatePipelineContact
} from './pipelineContacts'
import type { CreatePipelineContactArgs } from '../../../shared/types'

const migrations: Migration[] = [
  { id: '20260911T1900_init.sql', sql: initMigrationSql },
  { id: '20260912T1100_pipeline_contacts.sql', sql: pipelineContactsSql }
]

function freshDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:')
  runMigrations(db, migrations, () => undefined)
  return db
}

const NOW = new Date('2026-09-12T12:00:00.000Z')
const daysAgo = (d: number): string => new Date(NOW.getTime() - d * 24 * 60 * 60_000).toISOString()

function contact(overrides: Partial<CreatePipelineContactArgs> = {}): CreatePipelineContactArgs {
  return {
    platform: 'linkedin',
    company: 'Acme Corp',
    contactedAt: daysAgo(1),
    ...overrides
  }
}

describe('pipeline_contacts CRUD round-trip', () => {
  it('inserts a contact and reads it straight back', () => {
    const db = freshDb()
    const id = insertPipelineContact(
      db,
      contact({ externalJobId: 'job-1', contactNote: 'Recruiter DM on LinkedIn' }),
      NOW
    )

    const row = getPipelineContact(db, id)

    expect(row).toEqual({
      id,
      platform: 'linkedin',
      company: 'Acme Corp',
      externalJobId: 'job-1',
      contactedAt: daysAgo(1),
      contactNote: 'Recruiter DM on LinkedIn',
      interviewScheduledAt: null,
      lastFollowUpAt: null,
      status: 'contacted',
      createdAt: NOW.toISOString()
    })
  })

  it('defaults status to contacted and nullable fields to null when omitted', () => {
    const db = freshDb()
    const id = insertPipelineContact(db, contact(), NOW)

    const row = getPipelineContact(db, id)

    expect(row?.status).toBe('contacted')
    expect(row?.externalJobId).toBeNull()
    expect(row?.interviewScheduledAt).toBeNull()
    expect(row?.lastFollowUpAt).toBeNull()
  })

  it('lists contacts most-recent-first', () => {
    const db = freshDb()
    const firstId = insertPipelineContact(db, contact({ company: 'First Co' }), NOW)
    const secondId = insertPipelineContact(db, contact({ company: 'Second Co' }), NOW)

    const rows = listPipelineContacts(db)

    expect(rows.map((r) => r.id)).toEqual([secondId, firstId])
  })

  it('partially updates only the given fields', () => {
    const db = freshDb()
    const id = insertPipelineContact(db, contact({ status: 'contacted' }), NOW)

    updatePipelineContact(db, {
      id,
      status: 'interview_scheduled',
      interviewScheduledAt: daysAgo(0)
    })

    const row = getPipelineContact(db, id)
    expect(row?.status).toBe('interview_scheduled')
    expect(row?.interviewScheduledAt).toBe(daysAgo(0))
    // Untouched fields survive the partial update.
    expect(row?.company).toBe('Acme Corp')
  })

  it('deletes a contact', () => {
    const db = freshDb()
    const id = insertPipelineContact(db, contact(), NOW)

    deletePipelineContact(db, id)

    expect(getPipelineContact(db, id)).toBeUndefined()
    expect(listPipelineContacts(db)).toEqual([])
  })
})

describe('listFollowUpsDue', () => {
  it('surfaces a contact from 5 days ago with no interview scheduled and no follow-up logged', () => {
    const db = freshDb()
    insertPipelineContact(db, contact({ company: 'Stale Co', contactedAt: daysAgo(5) }), NOW)

    const due = listFollowUpsDue(db, 3, NOW)

    expect(due).toHaveLength(1)
    expect(due[0].company).toBe('Stale Co')
  })

  it('does not surface a contact from yesterday', () => {
    const db = freshDb()
    insertPipelineContact(db, contact({ company: 'Fresh Co', contactedAt: daysAgo(1) }), NOW)

    expect(listFollowUpsDue(db, 3, NOW)).toEqual([])
  })

  it('does not surface a contact that already has an interview scheduled', () => {
    const db = freshDb()
    insertPipelineContact(
      db,
      contact({
        company: 'Scheduled Co',
        contactedAt: daysAgo(5),
        interviewScheduledAt: daysAgo(1),
        status: 'interview_scheduled'
      }),
      NOW
    )

    expect(listFollowUpsDue(db, 3, NOW)).toEqual([])
  })

  it('uses lastFollowUpAt over contactedAt when a follow-up has already been logged', () => {
    const db = freshDb()
    // Contacted 10 days ago, but followed up yesterday - should NOT be due.
    const recentFollowUpId = insertPipelineContact(
      db,
      contact({ company: 'Recently followed up', contactedAt: daysAgo(10) }),
      NOW
    )
    updatePipelineContact(db, { id: recentFollowUpId, lastFollowUpAt: daysAgo(1) })

    // Contacted 10 days ago, followed up 5 days ago - should be due.
    const staleFollowUpId = insertPipelineContact(
      db,
      contact({ company: 'Stale follow-up', contactedAt: daysAgo(10) }),
      NOW
    )
    updatePipelineContact(db, { id: staleFollowUpId, lastFollowUpAt: daysAgo(5) })

    const due = listFollowUpsDue(db, 3, NOW)

    expect(due.map((r) => r.id)).toEqual([staleFollowUpId])
  })

  it('excludes closed entries even if otherwise stale', () => {
    const db = freshDb()
    insertPipelineContact(
      db,
      contact({ company: 'Ghosted Co', contactedAt: daysAgo(30), status: 'closed' }),
      NOW
    )

    expect(listFollowUpsDue(db, 3, NOW)).toEqual([])
  })

  it('returns an empty array when nothing has been logged', () => {
    const db = freshDb()
    expect(listFollowUpsDue(db, 3, NOW)).toEqual([])
  })
})
