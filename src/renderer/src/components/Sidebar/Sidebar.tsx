import type { Platform } from '../../../../shared/types'

const platforms: { id: Platform; label: string; soon?: boolean }[] = [
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'naukri', label: 'Naukri', soon: true }
]

export function Sidebar({
  activePlatform,
  onSelectPlatform
}: {
  activePlatform: Platform
  onSelectPlatform: (platform: Platform) => void
}): React.JSX.Element {
  return (
    <div className="sidebar">
      <h1 className="sidebar-title">Bojeno</h1>
      <div className="sidebar-platforms">
        {platforms.map((p) => (
          <button
            key={p.id}
            className={`sidebar-platform${p.id === activePlatform ? ' active' : ''}`}
            disabled={p.soon}
            onClick={() => onSelectPlatform(p.id)}
          >
            {p.label}
            {p.soon && <span className="sidebar-soon">Soon</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
