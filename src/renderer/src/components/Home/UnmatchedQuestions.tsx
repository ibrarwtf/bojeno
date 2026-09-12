import { useEffect, useState } from 'react'
import type { UnmatchedQuestionRow } from '../../../../shared/types'
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'

// TODO: open-ended/explain-style questions ("describe a RAG system you've
// built", etc.) get a free-text box here same as everything else, but a
// human still has to write the actual answer by hand every time. The
// eventual fix is an LLM call generating a draft answer, not a rule - keep
// that as its own follow-up, not bundled into this panel's first version.

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
    <div className="mt-4">
      <h2 className="mb-2 font-semibold">Unmatched Questions</h2>
      {groups.length === 0 ? (
        <p className="text-muted-foreground">No questions to review</p>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group) => {
            const example = group.rows[0]
            return (
              <Card key={group.questionLabel}>
                <CardHeader className="gap-1">
                  <CardTitle>{group.questionLabel}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {example.jobTitle ?? 'Unknown title'} · {example.company ?? 'Unknown company'}
                  </p>
                </CardHeader>
                <CardContent className="flex gap-2">
                  <Input
                    placeholder="Answer"
                    value={answers[group.questionLabel] ?? ''}
                    onChange={(e) =>
                      setAnswers((prev) => ({ ...prev, [group.questionLabel]: e.target.value }))
                    }
                  />
                  <Button
                    onClick={() => void save(group)}
                    disabled={
                      saving === group.questionLabel || !(answers[group.questionLabel] ?? '').trim()
                    }
                  >
                    Save
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
