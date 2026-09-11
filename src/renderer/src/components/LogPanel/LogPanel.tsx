import { useEffect, useState } from 'react'
import type { RunLogRow } from '../../../../shared/types'

const POLL_MS = 3000

export function LogPanel(): React.JSX.Element {
  const [logs, setLogs] = useState<RunLogRow[]>([])
  const [cleared, setCleared] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function poll(): Promise<void> {
      const rows = await window.bojeno.getRunLogs()
      if (!cancelled) setLogs(rows)
    }
    void poll()
    const interval = setInterval(() => void poll(), POLL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  // Query returns newest-first; reverse for a chronological top-to-bottom read.
  const visible = cleared ? [] : [...logs].reverse()

  return (
    <div className="log-panel">
      <div className="log-panel-header">
        <span>Live Logs (Current Run)</span>
        <button
          onClick={() => {
            setCleared(true)
          }}
        >
          Clear
        </button>
      </div>
      <div className="log-panel-body">
        {visible.length === 0 ? (
          <p className="log-panel-empty">No activity yet</p>
        ) : (
          visible.map((row, i) => (
            <div key={i} className="log-panel-row">
              <span className="log-panel-time">{new Date(row.timestamp).toLocaleTimeString()}</span>
              <span className="log-panel-script">{row.script}</span>
              <span className={`log-panel-outcome log-panel-outcome-${row.outcome}`}>
                {row.outcome}
              </span>
              {row.entityId && <span className="log-panel-entity">{row.entityId}</span>}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
