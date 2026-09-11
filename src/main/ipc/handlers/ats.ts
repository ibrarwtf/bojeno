import { ipcMain } from 'electron'
import { IpcChannels } from '../channels'
import type { AtsApplyArgs, AtsDiscoverArgs } from '../../../shared/ipc-contract'
import { discoverJobs } from '../../engine/discoverJobs'
import { applyToLeverJob, applyUrlFor } from '../../adapters/lever/apply'
import { withLock } from '../../lock'
import { showLeverTab } from '../../window'

/**
 * discoverJobs is a plain fetch - no view, no lock needed, unlike
 * linkedin.ts/naukri.ts. Apply is different: Lever now has its own docked
 * pane tab (window.ts's showLeverTab) that the apply flow navigates, so
 * per CLAUDE.md's navigation-locking rule this goes through withLock like
 * every other view-navigating action - two concurrent applies would
 * otherwise race the same WebContentsView's navigation into
 * net::ERR_ABORTED. showLeverTab() itself stays here (not inside
 * adapters/lever/apply.ts) for the same reason linkedin.ts calls
 * ensurePlatformViewLoaded() rather than the adapter doing it: keeps
 * Electron/window.ts out of the adapter's module graph.
 *
 * discoverJobs is genuinely uniform across every api-kind adapter (fetch
 * postings for a company, same shape every time), so it stays a shared
 * engine helper. Apply is NOT uniform - each ATS's apply flow is
 * structurally its own thing - so this routes straight to that platform's
 * own apply function instead of a shared dispatcher. Add a branch here per
 * platform as more api-kind adapters grow an apply capability.
 */
export function registerAtsHandlers(): void {
  ipcMain.handle(IpcChannels.atsDiscover, (_event, args: AtsDiscoverArgs) =>
    discoverJobs(args.source, args.companies)
  )

  ipcMain.handle(IpcChannels.atsApply, (_event, args: AtsApplyArgs) => {
    if (args.source !== 'lever')
      throw new Error(`no apply implementation for source "${args.source}"`)
    return withLock('lever', () => {
      showLeverTab(applyUrlFor(args.jobUrl))
      return applyToLeverJob(args.jobUrl, args.dryRun, args.company)
    })
  })
}
