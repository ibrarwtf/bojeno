import { ipcMain } from 'electron'
import { IpcChannels } from '../channels'
import type { AtsApplyArgs, AtsDiscoverArgs } from '../../../shared/ipc-contract'
import { discoverJobs } from '../../engine/discoverJobs'
import { applyToLeverJob } from '../../adapters/lever/apply'

/**
 * ATS (api-kind) adapters have no session/view/login gate, so unlike
 * linkedin.ts/naukri.ts this doesn't go through withLock or
 * ensurePlatformViewLoaded — there's no WebContentsView navigation to race.
 *
 * discoverJobs is genuinely uniform across every api-kind adapter (fetch
 * postings for a company, same shape every time), so it stays a shared
 * engine helper. Apply is NOT uniform - each ATS's apply flow is
 * structurally its own thing (Lever: raw form POST, no login, per-posting
 * custom questions) - so this routes straight to that platform's own
 * apply function instead of a shared dispatcher. Add a branch here per
 * platform as more api-kind adapters grow an apply capability.
 */
export function registerAtsHandlers(): void {
  ipcMain.handle(IpcChannels.atsDiscover, (_event, args: AtsDiscoverArgs) =>
    discoverJobs(args.source, args.companies)
  )

  ipcMain.handle(IpcChannels.atsApply, (_event, args: AtsApplyArgs) => {
    if (args.source !== 'lever')
      throw new Error(`no apply implementation for source "${args.source}"`)
    return applyToLeverJob(args.jobUrl, args.dryRun, args.company)
  })
}
