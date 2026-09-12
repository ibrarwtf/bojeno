import * as React from 'react'

import { cn } from '@renderer/lib/utils'

export function Input({
  className,
  type,
  ...props
}: React.ComponentProps<'input'>): React.JSX.Element {
  return (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring',
        className
      )}
      {...props}
    />
  )
}
