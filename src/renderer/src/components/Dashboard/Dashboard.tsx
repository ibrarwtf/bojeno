import { useState } from 'react'
import type { Platform } from '../../../../shared/types'
import { Sidebar } from '../Sidebar/Sidebar'
import { StatusBar } from '../StatusBar/StatusBar'
import { UrlBar } from '../UrlBar/UrlBar'
import { LogPanel } from '../LogPanel/LogPanel'

export function Dashboard(): React.JSX.Element {
  const [activePlatform, setActivePlatform] = useState<Platform>('linkedin')

  function selectPlatform(platform: Platform): void {
    setActivePlatform(platform)
    void window.bojeno.activateTab({ platform })
  }

  return (
    <>
      <Sidebar activePlatform={activePlatform} onSelectPlatform={selectPlatform} />
      <StatusBar platform={activePlatform} />
      <UrlBar />
      <LogPanel />
    </>
  )
}
