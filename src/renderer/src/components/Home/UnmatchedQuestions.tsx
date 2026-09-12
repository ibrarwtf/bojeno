import { useEffect, useState } from 'react'
import type { UnmatchedQuestionRow } from '../../../../shared/types'

interface QuestionGroup {
  questionLabel: string
  rows: UnmatchedQuestionRow[]
}

function groupByLabel(rows: UnmatchedQuestionRow[]): QuestionGroup[] {
  const groups = new Map<string, UnmatchedQuestionRow[]>()
  for (const row of rows) {
    const existing = groups.get(row.questionLabel)
    if (existing) {
      existing.push(row)
    } else {
      groups.set(row.questionLabel, [row])
    }
  }
  return Array.from(groups.entries()).map(([questionLabel, groupRows]) => ({
    questionLabel,
    rows: groupRows
  }))
}

export function UnmatchedQuestions(): React.JSX.Element {
  const [rows, setRows] = useState<UnmatchedQuestionRow[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | undefined>()
  const groups = groupByLabel(rows)

  async function refresh(): Promise<void> {
    setRows(await window.bojeno.getUnmatchedQuestions())
  }

  useEffect(() => {
    void (async () => {
      await refresh()
    })()
  }, [])

  async function save(group: QuestionGroup): Promise<void> {
    const answer = (answers[group.questionLabel] ?? '').trim()
    if (!answer) return
    setSaving(group.questionLabel)
    try {
      await Promise.all(
        group.rows.map((row) => window.bojeno.resolveUnmatchedQuestion(row.id, answer))
      )
      await refresh()
    } finally {
      setSaving(undefined)
    }
  }

  return (
    <div className="unmatched-questions">
      <div className="unmatched-questions-header">Unmatched Questions</div>
      {groups.length === 0 ? (
        <p className="home-empty">No questions to review</p>
      ) : (
        <div className="unmatched-questions-list">
          {groups.map((group) => {
            const example = group.rows[0]
            return (
              <div className="unmatched-questions-item" key={group.questionLabel}>
                <div className="unmatched-questions-item-label">{group.questionLabel}</div>
                <div className="unmatched-questions-item-meta">
                  {example.jobTitle ?? 'Unknown title'} · {example.company ?? 'Unknown company'}
                </div>
                <div className="unmatched-questions-item-form">
                  <input
                    placeholder="Answer"
                    value={answers[group.questionLabel] ?? ''}
                    onChange={(e) =>
                      setAnswers((prev) => ({ ...prev, [group.questionLabel]: e.target.value }))
                    }
                  />
                  <button
                    onClick={() => void save(group)}
                    disabled={
                      saving === group.questionLabel || !(answers[group.questionLabel] ?? '').trim()
                    }
                  >
                    Save
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
