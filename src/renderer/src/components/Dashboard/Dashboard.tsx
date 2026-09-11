import { useEffect, useState } from 'react'
import type { LoginStatus, Platform } from '../../../../shared/types'

const platforms: Platform[] = ['linkedin', 'naukri']

const platformLabel: Record<Platform, string> = {
  linkedin: 'LinkedIn',
  naukri: 'Naukri'
}

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

  return (
    <div className="dashboard">
      <h2>Bojeno</h2>
      {platforms.map((platform) => {
        const status = statuses[platform]
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
          </div>
        )
      })}
    </div>
  )
}
