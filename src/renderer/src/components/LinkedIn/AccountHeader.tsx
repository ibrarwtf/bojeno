import { useState } from 'react'
import type { LoginStatus } from '../../../../shared/types'

// Placeholder account-level stats until there's a real backend for them (no stats
// table/IPC exists yet - this is UI scaffolding only, not live data). LinkedIn-specific
// on purpose: Naukri's own account header (when that workspace is built) will have its
// own fields entirely (no "Connections", etc.), not a shared/parameterized shape.
//
// TODO: back these with real numbers instead of placeholders. LinkedIn's own caps are
// 50 applies/rolling 24h, 200 connection requests/week (see
// linkedin.com/mynetwork/invite-connect/connections/), 30 InMail/month. The applied
// count can be backfilled from LinkedIn's own job tracker total-applied count, mapped
// against our own DB rows.
const placeholderStats = [
  { label: 'Today', value: '12/25' },
  { label: 'Week', value: '28/100' },
  { label: 'Connections', value: '7/20' }
]

export function AccountHeader(): React.JSX.Element {
  const [status, setStatus] = useState<LoginStatus | undefined>()
  const [checking, setChecking] = useState(false)

  async function checkStatus(): Promise<void> {
    setChecking(true)
    try {
      setStatus(await window.bojeno.checkLogin('linkedin'))
    } finally {
      setChecking(false)
    }
  }

  function logInNow(): void {
    void window.bojeno.activateTab({ platform: 'linkedin', navigateToLogin: true })
  }

  return (
    <div className="linkedin-account-header">
      <div className="linkedin-account-header-top">
        <span className="linkedin-account-header-platform">LinkedIn</span>

        {status === undefined ? (
          <span className="linkedin-account-header-dim">Status not checked</span>
        ) : status.loggedIn ? (
          <span className="linkedin-account-header-dot linkedin-account-header-ok">Logged in</span>
        ) : (
          <span className="linkedin-account-header-dot linkedin-account-header-warn">
            Not logged in
            <button className="linkedin-account-header-link" onClick={logInNow}>
              Log in now
            </button>
          </span>
        )}

        <div className="linkedin-account-header-stats">
          {placeholderStats.map((stat) => (
            <span key={stat.label} className="linkedin-account-header-stat">
              <span className="linkedin-account-header-stat-value">{stat.value}</span>{' '}
              <span className="linkedin-account-header-stat-label">{stat.label}</span>
            </span>
          ))}
        </div>

        <button
          className="linkedin-account-header-check"
          onClick={() => void checkStatus()}
          disabled={checking}
        >
          {checking ? 'Checking…' : 'Check'}
        </button>
      </div>
    </div>
  )
}
