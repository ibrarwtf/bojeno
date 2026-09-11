import { ipcMain } from 'electron'
import { IpcChannels } from '../channels'
import { getAdapter } from '../../adapters/registry'
import { withLock } from '../../lock'
import { ensurePlatformViewLoaded } from '../../window'
import { fetchAppliedCount } from '../../engine/fetchAppliedCount'

export function registerNaukriHandlers(): void {
  ipcMain.handle(IpcChannels.naukriCheckLogin, () =>
    withLock('naukri', () => {
      ensurePlatformViewLoaded('naukri')
      const adapter = getAdapter('naukri')
      if (!adapter.checkLogin) throw new Error('naukri adapter has no checkLogin capability')
      return adapter.checkLogin()
    })
  )

  ipcMain.handle(IpcChannels.naukriFetchAppliedCount, () =>
    withLock('naukri', () => {
      ensurePlatformViewLoaded('naukri')
      return fetchAppliedCount('naukri')
    })
  )
}
