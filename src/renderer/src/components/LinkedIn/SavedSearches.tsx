import { useEffect, useState } from 'react'
import type { LinkedinSavedSearch } from '../../../../shared/types'

function relativeTime(iso: string | null): string {
  if (!iso) return 'Never run'
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function SavedSearches({
  selectedId,
  onSelect
}: {
  selectedId: number | undefined
  onSelect: (id: number) => void
}): React.JSX.Element {
  const [searches, setSearches] = useState<LinkedinSavedSearch[]>([])
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [keywords, setKeywords] = useState('')
  const [location, setLocation] = useState('')
  const [runningId, setRunningId] = useState<number | undefined>()
  const [activeRunId, setActiveRunId] = useState<string | undefined>()
  const [stopping, setStopping] = useState(false)
  const [dryRun, setDryRun] = useState(true)

  useEffect(() => {
    void refresh()
  }, [])

  async function refresh(): Promise<void> {
    setSearches(await window.bojeno.listSavedSearches())
  }

  async function submitCreate(): Promise<void> {
    if (!name.trim()) return
    const created = await window.bojeno.createSavedSearch({
      name: name.trim(),
      keywords: keywords.trim() || undefined,
      location: location.trim() || undefined
    })
    setName('')
    setKeywords('')
    setLocation('')
    setCreating(false)
    await refresh()
    onSelect(created.id)
  }

  async function remove(id: number): Promise<void> {
    await window.bojeno.deleteSavedSearch(id)
    await refresh()
  }

  // TODO: only one saved search should be able to run at a time per platform
  // (withLock('linkedin', ...) already serializes navigation at the IPC
  // handler level, but there's nothing here yet stopping a second search
  // from being kicked off while one is running and just queuing/blocking it
  // cleanly). No need for anything fancier than a simple lock - build this
  // when a second saved search actually exists, not before; there's only
  // ever been one so far.
  async function run(search: LinkedinSavedSearch): Promise<void> {
    const runId = crypto.randomUUID()
    setRunningId(search.id)
    setActiveRunId(runId)
    try {
      await window.bojeno.runSequentialSearch({
        runId,
        params: {
          keywords: search.keywords ?? undefined,
          location: search.location ?? undefined,
          geoId: search.geoId ?? undefined,
          distanceKm: search.distanceKm ?? undefined,
          sortByRecent: search.sortByRecent,
          easyApplyOnly: search.easyApplyOnly
        },
        dryRun,
        savedSearchName: search.name
      })
      await window.bojeno.touchSavedSearchLastRun(search.id)
      await refresh()
    } finally {
      setRunningId(undefined)
      setActiveRunId(undefined)
      setStopping(false)
    }
  }

  async function stop(): Promise<void> {
    if (!activeRunId) return
    setStopping(true)
    // Doesn't clear runningId itself - run()'s own finally does that once
    // the in-flight IPC call actually resolves (the main-process loop
    // notices the cancellation between jobs, not instantly).
    await window.bojeno.cancelRun(activeRunId)
  }

  return (
    <div className="linkedin-saved-searches">
      <div className="linkedin-saved-searches-header">
        <span>Saved Searches</span>
        <label className="linkedin-saved-searches-dry-run">
          <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
          Dry run
        </label>
        <button onClick={() => setCreating((v) => !v)}>+ New Search</button>
      </div>

      {creating && (
        <div className="linkedin-saved-searches-form">
          <input
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <input
            placeholder="Keyword"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
          />
          <input
            placeholder="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
          <div className="linkedin-saved-searches-form-actions">
            <button onClick={() => void submitCreate()} disabled={!name.trim()}>
              Save
            </button>
            <button onClick={() => setCreating(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="linkedin-saved-searches-list">
        {searches.length === 0 && !creating ? (
          <p className="linkedin-saved-searches-empty">No saved searches yet</p>
        ) : (
          searches.map((search) => (
            <div
              key={search.id}
              className={`linkedin-saved-searches-item${search.id === selectedId ? ' active' : ''}`}
              onClick={() => onSelect(search.id)}
            >
              <div className="linkedin-saved-searches-item-name">{search.name}</div>
              <div className="linkedin-saved-searches-item-meta">
                LinkedIn{search.location ? ` · ${search.location}` : ''} ·{' '}
                {runningId === search.id
                  ? stopping
                    ? 'Stopping…'
                    : 'Running…'
                  : relativeTime(search.lastRunAt)}
              </div>
              <div className="linkedin-saved-searches-item-actions">
                {runningId === search.id ? (
                  <button
                    className="linkedin-saved-searches-item-run linkedin-saved-searches-item-run-active"
                    title={stopping ? 'Stopping…' : 'Stop'}
                    disabled={stopping}
                    onClick={(e) => {
                      e.stopPropagation()
                      void stop()
                    }}
                  >
                    {stopping ? '…' : '■'}
                  </button>
                ) : (
                  <button
                    className="linkedin-saved-searches-item-run"
                    title="Run"
                    disabled={runningId !== undefined}
                    onClick={(e) => {
                      e.stopPropagation()
                      void run(search)
                    }}
                  >
                    ▶
                  </button>
                )}
                <button
                  className="linkedin-saved-searches-item-remove"
                  title="Delete"
                  onClick={(e) => {
                    e.stopPropagation()
                    void remove(search.id)
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
