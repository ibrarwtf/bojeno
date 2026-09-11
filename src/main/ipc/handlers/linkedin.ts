import { ipcMain } from 'electron'
import { IpcChannels } from '../channels'
import type { ScanJobsArgs } from '../../../shared/ipc-contract'
import { getAdapter } from '../../adapters/registry'
import { withLock } from '../../lock'
import { ensurePlatformViewLoaded } from '../../window'
import { fetchAppliedCount } from '../../engine/fetchAppliedCount'
import { fetchRecentAppliedJobs } from '../../engine/fetchRecentAppliedJobs'
import { applyToJob } from '../../engine/applyToJob'

export function registerLinkedinHandlers(): void {
  ipcMain.handle(IpcChannels.linkedinCheckLogin, () =>
    withLock('linkedin', () => {
      ensurePlatformViewLoaded('linkedin')
      const adapter = getAdapter('linkedin')
      if (!adapter.checkLogin) throw new Error('linkedin adapter has no checkLogin capability')
      return adapter.checkLogin()
    })
  )

  ipcMain.handle(IpcChannels.linkedinFetchAppliedCount, () =>
    withLock('linkedin', () => {
      ensurePlatformViewLoaded('linkedin')
      return fetchAppliedCount('linkedin')
    })
  )

  ipcMain.handle(IpcChannels.linkedinFetchRecentAppliedJobs, () =>
    withLock('linkedin', () => {
      ensurePlatformViewLoaded('linkedin')
      return fetchRecentAppliedJobs('linkedin')
    })
  )

  ipcMain.handle(IpcChannels.linkedinCaptureJobDetails, (_event, jobUrl: string) =>
    withLock('linkedin', () => {
      ensurePlatformViewLoaded('linkedin')
      const adapter = getAdapter('linkedin')
      if (!adapter.captureJobDetails) {
        throw new Error('linkedin adapter has no captureJobDetails capability')
      }
      return adapter.captureJobDetails(jobUrl)
    })
  )

  ipcMain.handle(IpcChannels.linkedinScanJobs, (_event, params: ScanJobsArgs) =>
    withLock('linkedin', () => {
      ensurePlatformViewLoaded('linkedin')
      const adapter = getAdapter('linkedin')
      if (!adapter.scanJobs) throw new Error('linkedin adapter has no scanJobs capability')
      return adapter.scanJobs(params)
    })
  )

  ipcMain.handle(IpcChannels.linkedinApplyToJob, (_event, jobId: string, dryRun: boolean) =>
    withLock('linkedin', () => {
      ensurePlatformViewLoaded('linkedin')
      return applyToJob('linkedin', jobId, dryRun)
    })
  )
}
