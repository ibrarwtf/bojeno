import { useEffect, useState } from 'react'
import type { FetchAppliedCountResult, LoginStatus, Platform } from '../../../../shared/types'

const platforms: Platform[] = ['linkedin', 'naukri']

const platformLabel: Record<Platform, string> = {
  linkedin: 'LinkedIn',
  naukri: 'Naukri'
}

// Only LinkedIn has the fetchAppliedCount capability wired so far (#5 adds Naukri).
const platformsWithAppliedCount: Platform[] = ['linkedin']

type Status = LoginStatus | { platform: Platform; loggedIn: undefined; checkedAt: undefined }

function initialStatuses(): Record<Platform, Status> {
  return {
    linkedin: { platform: 'linkedin', loggedIn: undefined, checkedAt: undefined },
    naukri: { platform: 'naukri', loggedIn: undefined, checkedAt: undefined }
  }
}

export function Dashboard(): React.JSX.Element {
  const [statuses, setStatuses] = useState<Record<Platform, Status>>(initialStatuses)
  const [checking, setChecking] = useState<Record<Platform, boolean>>({
    linkedin: false,
    naukri: false
  })
  const [appliedCounts, setAppliedCounts] = useState<
    Partial<Record<Platform, FetchAppliedCountResult>>
  >({})
  const [fetchingCount, setFetchingCount] = useState<Record<Platform, boolean>>({
    linkedin: false,
    naukri: false
  })

  async function checkPlatform(platform: Platform): Promise<void> {
    setChecking((prev) => ({ ...prev, [platform]: true }))
    try {
      const status = await window.bojeno.checkLogin(platform)
      setStatuses((prev) => ({ ...prev, [platform]: status }))
    } finally {
      setChecking((prev) => ({ ...prev, [platform]: false }))
    }
  }

  useEffect(() => {
    platforms.forEach((platform) => {
      void checkPlatform(platform)
    })
  }, [])

  function logInNow(platform: Platform): void {
    void window.bojeno.activateTab({ platform, navigateToLogin: true })
  }

  async function fetchCount(platform: Platform): Promise<void> {
    setFetchingCount((prev) => ({ ...prev, [platform]: true }))
    try {
      const result = await window.bojeno.fetchAppliedCount(platform)
      setAppliedCounts((prev) => ({ ...prev, [platform]: result }))
      if (result.outcome === 'auth_required') {
        setStatuses((prev) => ({
          ...prev,
          [platform]: { platform, loggedIn: false, checkedAt: new Date().toISOString() }
        }))
      }
    } finally {
      setFetchingCount((prev) => ({ ...prev, [platform]: false }))
    }
  }

  return (
    <div className="dashboard">
      <h2>Bojeno</h2>
      {platforms.map((platform) => {
        const status = statuses[platform]
        const countResult = appliedCounts[platform]
        return (
          <div key={platform} className="platform-card">
            <div className="platform-card-header">
              <strong>{platformLabel[platform]}</strong>
              <button onClick={() => void checkPlatform(platform)} disabled={checking[platform]}>
                {checking[platform] ? 'Checking…' : 'Recheck'}
              </button>
            </div>
            {status.loggedIn === undefined ? (
              <p>Checking login status…</p>
            ) : status.loggedIn ? (
              <p className="status-ok">Logged in</p>
            ) : (
              <div className="login-banner">
                <p>Not logged in</p>
                <button onClick={() => logInNow(platform)}>Log in now</button>
              </div>
            )}
            {platformsWithAppliedCount.includes(platform) && (
              <div className="applied-count">
                <button
                  onClick={() => void fetchCount(platform)}
                  disabled={fetchingCount[platform]}
                >
                  {fetchingCount[platform] ? 'Fetching…' : 'Fetch applied count'}
                </button>
                {countResult?.outcome === 'success' && (
                  <p>
                    Applied: <strong>{countResult.count}</strong>
                  </p>
                )}
                {countResult?.outcome === 'failed' && <p className="status-error">Fetch failed</p>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
