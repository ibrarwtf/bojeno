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

  return (
    <div className="linkedin-saved-searches">
      <div className="linkedin-saved-searches-header">
        <span>Saved Searches</span>
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
                {relativeTime(search.lastRunAt)}
              </div>
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
          ))
        )}
      </div>
    </div>
  )
}
