import type { Adapter } from './types'
import { linkedinAdapter } from './linkedin/adapter'
import { naukriAdapter } from './naukri/adapter'
import { leverAdapter } from './lever/adapter'

const adapters = new Map<string, Adapter>([
  [linkedinAdapter.id, linkedinAdapter],
  [naukriAdapter.id, naukriAdapter],
  [leverAdapter.id, leverAdapter]
])

export function getAdapter(id: string): Adapter {
  const adapter = adapters.get(id)
  if (!adapter) throw new Error(`No adapter registered for id "${id}"`)
  return adapter
}
