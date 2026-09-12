import { useState } from 'react'
import type { LoginStatus } from '../../../../shared/types'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'

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
    <div className="fixed top-0 right-0 left-[360px] z-10 flex h-11 flex-col border-b border-border">
      <div className="flex h-11 items-center gap-4 px-4">
        <span className="font-semibold">LinkedIn</span>

        {status === undefined ? (
          <span className="text-sm text-muted-foreground">Status not checked</span>
        ) : status.loggedIn ? (
          <Badge variant="success">Logged in</Badge>
        ) : (
          <span className="flex items-center gap-2 text-sm">
            <Badge variant="warning">Not logged in</Badge>
            <Button variant="link" size="sm" className="h-auto p-0 text-sm" onClick={logInNow}>
              Log in now
            </Button>
          </span>
        )}

        <div className="flex items-center gap-4 text-sm">
          {placeholderStats.map((stat) => (
            <span key={stat.label}>
              <span className="font-semibold">{stat.value}</span>{' '}
              <span className="text-muted-foreground">{stat.label}</span>
            </span>
          ))}
        </div>

        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          onClick={() => void checkStatus()}
          disabled={checking}
        >
          {checking ? 'Checking…' : 'Check'}
        </Button>
      </div>
    </div>
  )
}
