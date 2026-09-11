import type { Platform } from '../../../../shared/types'

export type ActiveView = 'home' | Platform

const platforms: { id: Platform; label: string; icon: string; soon?: boolean }[] = [
  { id: 'linkedin', label: 'LinkedIn', icon: 'in' },
  { id: 'naukri', label: 'Naukri', icon: 'N', soon: true }
]

export function Sidebar({
  activeView,
  onSelectView
}: {
  activeView: ActiveView
  onSelectView: (view: ActiveView) => void
}): React.JSX.Element {
  return (
    <div className="sidebar">
      <h1 className="sidebar-title">Bojeno</h1>
      <div className="sidebar-nav">
        <button
          className={`sidebar-item${activeView === 'home' ? ' active' : ''}`}
          onClick={() => onSelectView('home')}
        >
          <span className="sidebar-icon" aria-hidden="true">
            ⌂
          </span>
          Home
        </button>
        <div className="sidebar-platforms">
          {platforms.map((p) => (
            <button
              key={p.id}
              className={`sidebar-item${p.id === activeView ? ' active' : ''}`}
              disabled={p.soon}
              onClick={() => onSelectView(p.id)}
            >
              <span className="sidebar-icon" aria-hidden="true">
                {p.icon}
              </span>
              {p.label}
              {p.soon && <span className="sidebar-soon">Soon</span>}
            </button>
          ))}
        </div>
      </div>
      <button className="sidebar-item sidebar-settings" disabled>
        <span className="sidebar-icon" aria-hidden="true">
          ⚙
        </span>
        Settings
      </button>
    </div>
  )
}
