import { ipcMain } from 'electron'
import { IpcChannels } from '../channels'
import type { AtsDiscoverArgs } from '../../../shared/ipc-contract'
import { discoverJobs } from '../../engine/discoverJobs'

/**
 * ATS (api-kind) adapters have no session/view/login gate, so unlike
 * linkedin.ts/naukri.ts this doesn't go through withLock or
 * ensurePlatformViewLoaded — there's no WebContentsView navigation to race.
 */
export function registerAtsHandlers(): void {
  ipcMain.handle(IpcChannels.atsDiscover, (_event, args: AtsDiscoverArgs) =>
    discoverJobs(args.source, args.companies)
  )
}
