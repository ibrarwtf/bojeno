import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { runMigrations, type Migration } from '../db/migrate'
import initMigrationSql from '../db/migrations/20260911T1900_init.sql?raw'
import jobSnapshotsAndUnmatchedQuestionsSql from '../db/migrations/20260912T0200_job_snapshots_and_unmatched_questions.sql?raw'
import unmatchedQuestionsContextSql from '../db/migrations/20260912T0300_unmatched_questions_context.sql?raw'
import unmatchedQuestionsNotifiedAtSql from '../db/migrations/20260912T1000_unmatched_questions_notified_at.sql?raw'
import type { UnmatchedQuestionArgs } from '../db/queries/unmatchedQuestions'

const { notificationInstances, isSupported } = vi.hoisted(() => ({
  notificationInstances: [] as {
    options: { title: string; body: string }
    show: ReturnType<typeof vi.fn>
    on: ReturnType<typeof vi.fn>
  }[],
  isSupported: vi.fn(() => true)
}))

vi.mock('electron', () => ({
  Notification: class {
    static isSupported = isSupported
    show = vi.fn()
    on = vi.fn()
    constructor(public options: { title: string; body: string }) {
      notificationInstances.push(this as unknown as (typeof notificationInstances)[number])
    }
  }
}))

vi.mock('../window', () => ({ focusMainWindow: vi.fn() }))

import { insertUnmatchedQuestionAndNotify } from './unmatchedQuestionNotifier'

const migrations: Migration[] = [
  { id: '20260911T1900_init.sql', sql: initMigrationSql },
  {
    id: '20260912T0200_job_snapshots_and_unmatched_questions.sql',
    sql: jobSnapshotsAndUnmatchedQuestionsSql
  },
  { id: '20260912T0300_unmatched_questions_context.sql', sql: unmatchedQuestionsContextSql },
  {
    id: '20260912T1000_unmatched_questions_notified_at.sql',
    sql: unmatchedQuestionsNotifiedAtSql
  }
]

function freshDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:')
  runMigrations(db, migrations, () => undefined)
  return db
}

function args(overrides: Partial<UnmatchedQuestionArgs> = {}): UnmatchedQuestionArgs {
  return {
    platform: 'linkedin',
    externalJobId: 'job-1',
    jobUrl: 'https://www.linkedin.com/jobs/view/job-1/',
    jobTitle: 'Senior Engineer',
    company: 'Acme Corp',
    questionKind: 'text',
    questionLabel: 'Why do you want this role?',
    ...overrides
  }
}

describe('insertUnmatchedQuestionAndNotify', () => {
  beforeEach(() => {
    notificationInstances.length = 0
    isSupported.mockReturnValue(true)
  })

  it('fires exactly one notification for a new unresolved question', () => {
    const db = freshDb()

    insertUnmatchedQuestionAndNotify(db, args())

    expect(notificationInstances).toHaveLength(1)
    expect(notificationInstances[0].options.title).toContain('screening question')
    expect(notificationInstances[0].options.body).toBe('Senior Engineer at Acme Corp')
    expect(notificationInstances[0].show).toHaveBeenCalledTimes(1)

    const rows = db.prepare('SELECT notified_at FROM unmatched_questions').all() as {
      notified_at: string | null
    }[]
    expect(rows).toHaveLength(1)
    expect(rows[0].notified_at).not.toBeNull()
  })

  it('does not re-notify for a second row on an already-notified question', () => {
    const db = freshDb()

    insertUnmatchedQuestionAndNotify(db, args())
    insertUnmatchedQuestionAndNotify(db, args())

    expect(notificationInstances).toHaveLength(1)

    const rows = db.prepare('SELECT COUNT(*) as count FROM unmatched_questions').get() as {
      count: number
    }
    expect(rows.count).toBe(2)
  })

  it('notifies again for a genuinely different question', () => {
    const db = freshDb()

    insertUnmatchedQuestionAndNotify(db, args())
    insertUnmatchedQuestionAndNotify(db, args({ questionLabel: 'What is your notice period?' }))

    expect(notificationInstances).toHaveLength(2)
  })

  it('does not construct a notification when the OS does not support it', () => {
    isSupported.mockReturnValue(false)
    const db = freshDb()

    insertUnmatchedQuestionAndNotify(db, args())

    expect(notificationInstances).toHaveLength(0)
    const rows = db.prepare('SELECT notified_at FROM unmatched_questions').get() as {
      notified_at: string | null
    }
    expect(rows.notified_at).toBeNull()
  })
})
