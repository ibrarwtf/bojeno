import type { RunMode } from '../shared/types'

/**
 * Global run mode, checked at action-time by every adapter action. No
 * settings UI to change this yet (out of scope) — the gate exists and is
 * exercised now so later actions don't need retrofitting. Defaults to
 * 'live' since read-only discovery actions like fetching a count carry
 * none of the risk the mode switch exists to guard against (no mutating
 * action against the external platform).
 */
let currentMode: RunMode = 'live'

export function getMode(): RunMode {
  return currentMode
}

export function setMode(mode: RunMode): void {
  currentMode = mode
}
