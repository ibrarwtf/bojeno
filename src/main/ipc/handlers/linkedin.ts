import { ipcMain } from 'electron'
import { IpcChannels } from '../channels'
import { getAdapter } from '../../adapters/registry'
import { withLock } from '../../lock'
import { fetchAppliedCount } from '../../engine/fetchAppliedCount'

export function registerLinkedinHandlers(): void {
  ipcMain.handle(IpcChannels.linkedinCheckLogin, () =>
    withLock('linkedin', () => {
      const adapter = getAdapter('linkedin')
      if (!adapter.checkLogin) throw new Error('linkedin adapter has no checkLogin capability')
      return adapter.checkLogin()
    })
  )

  ipcMain.handle(IpcChannels.linkedinFetchAppliedCount, () =>
    withLock('linkedin', () => fetchAppliedCount('linkedin'))
  )
}
