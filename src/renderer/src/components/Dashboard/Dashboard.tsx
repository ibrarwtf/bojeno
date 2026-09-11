import { useState } from 'react'
import type {
  FetchAppliedCountResult,
  FetchRecentAppliedJobsResult,
  LoginStatus,
  Platform
} from '../../../../shared/types'
import { Tracker } from '../Tracker/Tracker'

const platforms: Platform[] = ['linkedin', 'naukri']

const platformLabel: Record<Platform, string> = {
  linkedin: 'LinkedIn',
  naukri: 'Naukri'
}

const metricLabel: Record<string, string> = {
  applied: 'Applied',
  recruiter_actions: 'Recruiter actions'
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
  const [appliedCounts, setAppliedCounts] = useState<
    Partial<Record<Platform, FetchAppliedCountResult>>
  >({})
  const [fetchingCount, setFetchingCount] = useState<Record<Platform, boolean>>({
    linkedin: false,
    naukri: false
  })
  const [trackerRefreshKey, setTrackerRefreshKey] = useState(0)
  const [recentJobsResult, setRecentJobsResult] = useState<FetchRecentAppliedJobsResult>()
  const [fetchingRecentJobs, setFetchingRecentJobs] = useState(false)

  async function checkPlatform(platform: Platform): Promise<void> {
    setChecking((prev) => ({ ...prev, [platform]: true }))
    try {
      const status = await window.bojeno.checkLogin(platform)
      setStatuses((prev) => ({ ...prev, [platform]: status }))
    } finally {
      setChecking((prev) => ({ ...prev, [platform]: false }))
    }
  }

  // Deliberately no auto-check-on-mount here: every app launch used to hit
  // both LinkedIn and Naukri unconditionally just to render the dashboard,
  // which is unnecessary traffic against real accounts and a rate-limit
  // risk. Login status starts unknown and is only checked on request.

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
      if (result.outcome === 'success') {
        setTrackerRefreshKey((key) => key + 1)
      }
    } finally {
      setFetchingCount((prev) => ({ ...prev, [platform]: false }))
    }
  }

  async function fetchRecentJobs(): Promise<void> {
    setFetchingRecentJobs(true)
    try {
      const result = await window.bojeno.fetchRecentAppliedJobs('linkedin')
      setRecentJobsResult(result)
      if (result.outcome === 'auth_required') {
        setStatuses((prev) => ({
          ...prev,
          linkedin: { platform: 'linkedin', loggedIn: false, checkedAt: new Date().toISOString() }
        }))
      }
    } finally {
      setFetchingRecentJobs(false)
    }
  }

  return (
    <div className="dashboard">
      <h2>⍢ Bojeno</h2>
      {platforms.map((platform) => {
        const status = statuses[platform]
        const countResult = appliedCounts[platform]
        return (
          <div key={platform} className="platform-card">
            <div className="platform-card-header">
              <strong>{platformLabel[platform]}</strong>
              <button onClick={() => void checkPlatform(platform)} disabled={checking[platform]}>
                {checking[platform]
                  ? 'Checking…'
                  : status.loggedIn === undefined
                    ? 'Check login'
                    : 'Recheck'}
              </button>
            </div>
            {status.loggedIn === undefined ? (
              <p>Login status not checked yet</p>
            ) : status.loggedIn ? (
              <p className="status-ok">Logged in</p>
            ) : (
              <div className="login-banner">
                <p>Not logged in</p>
                <button onClick={() => logInNow(platform)}>Log in now</button>
              </div>
            )}
            <div className="applied-count">
              <button onClick={() => void fetchCount(platform)} disabled={fetchingCount[platform]}>
                {fetchingCount[platform] ? 'Fetching…' : 'Fetch applied count'}
              </button>
              {countResult?.outcome === 'success' &&
                countResult.metrics &&
                Object.entries(countResult.metrics).map(([metric, count]) => (
                  <p key={metric}>
                    {metricLabel[metric] ?? metric}: <strong>{count}</strong>
                  </p>
                ))}
              {countResult?.outcome === 'failed' && <p className="status-error">Fetch failed</p>}
            </div>
            {platform === 'linkedin' && (
              <div className="applied-count">
                <button onClick={() => void fetchRecentJobs()} disabled={fetchingRecentJobs}>
                  {fetchingRecentJobs ? 'Fetching…' : 'Fetch jobs applied (past 24h)'}
                </button>
                {recentJobsResult?.outcome === 'success' && (
                  <p>
                    Found <strong>{recentJobsResult.jobsFound}</strong> job
                    {recentJobsResult.jobsFound === 1 ? '' : 's'} applied in the past 24h
                  </p>
                )}
                {recentJobsResult?.outcome === 'failed' && (
                  <p className="status-error">Fetch failed</p>
                )}
              </div>
            )}
          </div>
        )
      })}
      <Tracker refreshKey={trackerRefreshKey} />
    </div>
  )
}
