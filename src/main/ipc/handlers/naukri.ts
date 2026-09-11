import { ipcMain } from 'electron'
import { IpcChannels } from '../channels'
import { withLock } from '../../lock'
import { ensurePlatformViewLoaded } from '../../window'
import { checkLogin } from '../../adapters/naukri/adapter'

export function registerNaukriHandlers(): void {
  ipcMain.handle(IpcChannels.naukriCheckLogin, () =>
    withLock('naukri', () => {
      ensurePlatformViewLoaded('naukri')
      return checkLogin()
    })
  )
}
