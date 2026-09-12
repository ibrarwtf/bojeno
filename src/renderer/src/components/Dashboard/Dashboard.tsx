import { useState } from 'react'
import { Sidebar, type ActiveView } from '../Sidebar/Sidebar'
import { AccountHeader } from '../LinkedIn/AccountHeader'
import { SavedSearches } from '../LinkedIn/SavedSearches'
import { UrlBar } from '../UrlBar/UrlBar'
import { LogPanel } from '../LogPanel/LogPanel'
import { Home } from '../Home/Home'
import { Pipeline } from '../Pipeline/Pipeline'

export function Dashboard(): React.JSX.Element {
  const [activeView, setActiveView] = useState<ActiveView>('home')
  const [selectedSearchId, setSelectedSearchId] = useState<number | undefined>()

  function selectView(view: ActiveView): void {
    setActiveView(view)
    if (view === 'home' || view === 'pipeline') {
      void window.bojeno.showHome()
    } else {
      void window.bojeno.activateTab({ platform: view })
    }
  }

  return (
    <>
      <Sidebar activeView={activeView} onSelectView={selectView} />
      {activeView === 'home' && <Home />}
      {activeView === 'pipeline' && (
        <div className="home">
          <Pipeline />
        </div>
      )}
      {activeView === 'linkedin' && (
        <>
          <SavedSearches selectedId={selectedSearchId} onSelect={setSelectedSearchId} />
          <AccountHeader />
          <UrlBar />
          <LogPanel />
        </>
      )}
    </>
  )
}
