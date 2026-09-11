import { useState } from 'react'
import type { LoginStatus, Platform } from '../../../../shared/types'

const platformLabel: Record<Platform, string> = {
  linkedin: 'LinkedIn',
  naukri: 'Naukri'
}

// Placeholder account-level stats until there's a real backend for them (no stats
// table/IPC exists yet - this is UI scaffolding only, not live data). LinkedIn-only
// for now since Naukri's workspace isn't reachable yet.
const placeholderLinkedinStats = [
  { label: 'Today', value: '12 / 25', unit: 'applied' },
  { label: 'This week', value: '28 / 100', unit: 'applied' },
  { label: 'Connections', value: '7 / 20', unit: 'sent this week' }
]

export function StatusBar({ platform }: { platform: Platform }): React.JSX.Element {
  const [status, setStatus] = useState<LoginStatus | undefined>()
  const [checking, setChecking] = useState(false)

  async function checkStatus(): Promise<void> {
    setChecking(true)
    try {
      setStatus(await window.bojeno.checkLogin(platform))
    } finally {
      setChecking(false)
    }
  }

  function logInNow(): void {
    void window.bojeno.activateTab({ platform, navigateToLogin: true })
  }

  return (
    <div className="status-bar">
      <div className="status-bar-top">
        <span className="status-bar-platform">{platformLabel[platform]}</span>

        {status === undefined ? (
          <span className="status-bar-dim">Status not checked</span>
        ) : status.loggedIn ? (
          <span className="status-bar-dot status-bar-ok">Logged in</span>
        ) : (
          <span className="status-bar-dot status-bar-warn">
            Not logged in
            <button className="status-bar-link" onClick={logInNow}>
              Log in now
            </button>
          </span>
        )}

        <button className="status-bar-check" onClick={() => void checkStatus()} disabled={checking}>
          {checking ? 'Checking…' : 'Check'}
        </button>
      </div>

      {platform === 'linkedin' && (
        <div className="status-bar-stats">
          {placeholderLinkedinStats.map((stat) => (
            <div key={stat.label} className="status-bar-stat">
              <span className="status-bar-stat-label">{stat.label}</span>
              <span className="status-bar-stat-value">{stat.value}</span>
              <span className="status-bar-stat-unit">{stat.unit}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
