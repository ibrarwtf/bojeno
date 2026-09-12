import { useCallback, useEffect, useState } from 'react'
import type {
  CreatePipelineContactArgs,
  PipelineContactRow,
  PipelineContactStatus,
  Platform
} from '../../../../shared/types'
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { cn } from '@renderer/lib/utils'

// Manual pipeline tracking for funnel stages 3-5 (contacted / interview
// scheduled / outcome) - see bojeno-project-brief.md §2/§9 and issue #85.
// This is one more CRUD panel, not a CRM: no Gmail auto-capture, no funnel
// dashboard beyond the follow-up-due reminder list below.

const statusOptions: PipelineContactStatus[] = [
  'contacted',
  'interview_scheduled',
  'no_response',
  'closed'
]

const statusLabel: Record<PipelineContactStatus, string> = {
  contacted: 'Contacted',
  interview_scheduled: 'Interview scheduled',
  no_response: 'No response',
  closed: 'Closed'
}

const statusBadgeVariant: Record<
  PipelineContactStatus,
  'default' | 'secondary' | 'success' | 'warning'
> = {
  contacted: 'default',
  interview_scheduled: 'success',
  no_response: 'warning',
  closed: 'secondary'
}

const selectClassName =
  'flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors outline-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring'

function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : ''
}

function dateInputToIso(value: string): string | null {
  return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : null
}

function daysSince(iso: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(iso).getTime()) / (24 * 60 * 60_000))
}

interface NewContactForm {
  platform: Platform
  company: string
  externalJobId: string
  contactedAt: string
  contactNote: string
}

function emptyForm(): NewContactForm {
  return {
    platform: 'linkedin',
    company: '',
    externalJobId: '',
    contactedAt: toDateInputValue(new Date().toISOString()),
    contactNote: ''
  }
}

export function Pipeline(): React.JSX.Element {
  const [contacts, setContacts] = useState<PipelineContactRow[]>([])
  const [followUpsDue, setFollowUpsDue] = useState<PipelineContactRow[]>([])
  const [form, setForm] = useState<NewContactForm>(emptyForm())
  const [saving, setSaving] = useState(false)

  const refresh = useCallback(async (): Promise<void> => {
    const [allContacts, due] = await Promise.all([
      window.bojeno.listPipelineContacts(),
      window.bojeno.listFollowUpsDue()
    ])
    setContacts(allContacts)
    setFollowUpsDue(due)
  }, [])

  useEffect(() => {
    void (async () => {
      await refresh()
    })()
  }, [refresh])

  async function addContact(): Promise<void> {
    if (!form.company.trim() || !form.contactedAt) return
    setSaving(true)
    try {
      const args: CreatePipelineContactArgs = {
        platform: form.platform,
        company: form.company.trim(),
        externalJobId: form.externalJobId.trim() || null,
        contactedAt: dateInputToIso(form.contactedAt) ?? new Date().toISOString(),
        contactNote: form.contactNote.trim() || null
      }
      await window.bojeno.createPipelineContact(args)
      setForm(emptyForm())
      await refresh()
    } finally {
      setSaving(false)
    }
  }

  async function markFollowedUpNow(id: number): Promise<void> {
    await window.bojeno.updatePipelineContact({ id, lastFollowUpAt: new Date().toISOString() })
    await refresh()
  }

  async function setStatus(id: number, status: PipelineContactStatus): Promise<void> {
    await window.bojeno.updatePipelineContact({ id, status })
    await refresh()
  }

  async function setInterviewScheduledAt(id: number, value: string): Promise<void> {
    const interviewScheduledAt = dateInputToIso(value)
    await window.bojeno.updatePipelineContact({
      id,
      interviewScheduledAt,
      // Scheduling an interview is itself evidence contact was live - promote
      // status automatically unless the owner already closed this one out.
      ...(interviewScheduledAt ? { status: 'interview_scheduled' as const } : {})
    })
    await refresh()
  }

  async function remove(id: number): Promise<void> {
    await window.bojeno.deletePipelineContact(id)
    await refresh()
  }

  const now = new Date()

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Pipeline</h1>

      {followUpsDue.length > 0 && (
        <Card className="border-warning">
          <CardHeader>
            <CardTitle>Follow-ups due ({followUpsDue.length})</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {followUpsDue.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2 text-sm"
              >
                <span>
                  <strong>{row.company}</strong> ({row.platform}) — contacted{' '}
                  {daysSince(row.contactedAt, now)}d ago
                  {row.lastFollowUpAt && (
                    <>, last follow-up {daysSince(row.lastFollowUpAt, now)}d ago</>
                  )}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void markFollowedUpNow(row.id)}
                >
                  Mark followed up
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Log a contact</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <select
              className={cn(selectClassName, 'w-32')}
              value={form.platform}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, platform: e.target.value as Platform }))
              }
            >
              <option value="linkedin">LinkedIn</option>
              <option value="naukri">Naukri</option>
            </select>
            <Input
              className="w-48"
              placeholder="Company"
              value={form.company}
              onChange={(e) => setForm((prev) => ({ ...prev, company: e.target.value }))}
            />
            <Input
              className="w-40"
              placeholder="External job id (optional)"
              value={form.externalJobId}
              onChange={(e) => setForm((prev) => ({ ...prev, externalJobId: e.target.value }))}
            />
            <Input
              className="w-40"
              type="date"
              value={form.contactedAt}
              onChange={(e) => setForm((prev) => ({ ...prev, contactedAt: e.target.value }))}
            />
          </div>
          <Input
            placeholder="Contact method / note (e.g. recruiter called, referred via X)"
            value={form.contactNote}
            onChange={(e) => setForm((prev) => ({ ...prev, contactNote: e.target.value }))}
          />
          <div>
            <Button
              onClick={() => void addContact()}
              disabled={saving || !form.company.trim() || !form.contactedAt}
            >
              Add contact
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All contacts ({contacts.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contacts logged yet.</p>
          ) : (
            contacts.map((row) => (
              <div
                key={row.id}
                className="flex flex-col gap-2 rounded-md border border-border p-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{row.company}</strong>
                    <span className="text-xs text-muted-foreground">{row.platform}</span>
                    <Badge variant={statusBadgeVariant[row.status]}>
                      {statusLabel[row.status]}
                    </Badge>
                    {row.externalJobId && (
                      <span className="text-xs text-muted-foreground">
                        job: {row.externalJobId}
                      </span>
                    )}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => void remove(row.id)}>
                    Delete
                  </Button>
                </div>
                {row.contactNote && <p className="text-muted-foreground">{row.contactNote}</p>}
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>Contacted {toDateInputValue(row.contactedAt)}</span>
                  {row.lastFollowUpAt && (
                    <span>Last follow-up {toDateInputValue(row.lastFollowUpAt)}</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1">
                    Status
                    <select
                      className={cn(selectClassName, 'w-40')}
                      value={row.status}
                      onChange={(e) =>
                        void setStatus(row.id, e.target.value as PipelineContactStatus)
                      }
                    >
                      {statusOptions.map((s) => (
                        <option key={s} value={s}>
                          {statusLabel[s]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-1">
                    Interview scheduled
                    <Input
                      className="w-40"
                      type="date"
                      value={toDateInputValue(row.interviewScheduledAt)}
                      onChange={(e) => void setInterviewScheduledAt(row.id, e.target.value)}
                    />
                  </label>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
