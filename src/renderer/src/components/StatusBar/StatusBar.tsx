import { useState } from 'react'
import type { FetchAppliedCountResult, LoginStatus, Platform } from '../../../../shared/types'

const platformLabel: Record<Platform, string> = {
  linkedin: 'LinkedIn',
  naukri: 'Naukri'
}

export function StatusBar({ platform }: { platform: Platform }): React.JSX.Element {
  const [status, setStatus] = useState<LoginStatus | undefined>()
  const [applied, setApplied] = useState<FetchAppliedCountResult | undefined>()
  const [checking, setChecking] = useState(false)

  async function checkStatus(): Promise<void> {
    setChecking(true)
    try {
      const [loginResult, countResult] = await Promise.all([
        window.bojeno.checkLogin(platform),
        window.bojeno.fetchAppliedCount(platform)
      ])
      setStatus(loginResult)
      setApplied(countResult)
    } finally {
      setChecking(false)
    }
  }

  function logInNow(): void {
    void window.bojeno.activateTab({ platform, navigateToLogin: true })
  }

  const appliedCount =
    applied?.outcome === 'success' ? Object.values(applied.metrics ?? {})[0] : undefined

  return (
    <div className="status-bar">
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

      {appliedCount !== undefined && (
        <span className="status-bar-dim">
          Applied: <strong>{appliedCount}</strong>
        </span>
      )}

      <button className="status-bar-check" onClick={() => void checkStatus()} disabled={checking}>
        {checking ? 'Checking…' : 'Check'}
      </button>
    </div>
  )
}
