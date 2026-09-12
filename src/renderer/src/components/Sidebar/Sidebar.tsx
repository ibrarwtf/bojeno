import type { Platform } from '../../../../shared/types'
import { cn } from '@renderer/lib/utils'

export type ActiveView = 'home' | Platform

const platforms: { id: Platform; label: string; icon: string; soon?: boolean }[] = [
  { id: 'linkedin', label: 'LinkedIn', icon: 'in' },
  { id: 'naukri', label: 'Naukri', icon: 'N', soon: true }
]

function SidebarItem({
  active,
  disabled,
  title,
  onClick,
  children
}: {
  active?: boolean
  disabled?: boolean
  title: string
  onClick?: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-md text-sm font-semibold text-foreground transition-colors',
        active && 'bg-accent font-semibold',
        disabled ? 'cursor-default text-muted-foreground' : 'cursor-pointer hover:bg-accent'
      )}
      title={title}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="inline-flex items-center justify-center" aria-hidden="true">
        {children}
      </span>
    </button>
  )
}

export function Sidebar({
  activeView,
  onSelectView
}: {
  activeView: ActiveView
  onSelectView: (view: ActiveView) => void
}): React.JSX.Element {
  return (
    <div className="fixed top-0 left-0 z-10 flex h-screen w-16 flex-col items-center gap-4 overflow-y-auto border-r border-border py-3">
      <span className="text-xl" title="Bojeno" aria-hidden="true">
        ⍢
      </span>
      <div className="flex flex-1 flex-col gap-4">
        <SidebarItem
          active={activeView === 'home'}
          title="Home"
          onClick={() => onSelectView('home')}
        >
          ⌂
        </SidebarItem>
        <div className="flex flex-col gap-1">
          {platforms.map((p) => (
            <SidebarItem
              key={p.id}
              active={p.id === activeView}
              disabled={p.soon}
              title={p.soon ? `${p.label} (soon)` : p.label}
              onClick={() => onSelectView(p.id)}
            >
              {p.icon}
            </SidebarItem>
          ))}
        </div>
      </div>
      <SidebarItem disabled title="Settings">
        ⚙
      </SidebarItem>
    </div>
  )
}
