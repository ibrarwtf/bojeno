import { ipcMain } from 'electron'
import { IpcChannels, type ActivateTabArgs } from '../../../shared/ipc-contract'
import { activateTab } from '../../window'

export function registerPlatformHandlers(): void {
  ipcMain.handle(IpcChannels.platformActivateTab, (_event, args: ActivateTabArgs) => {
    activateTab(args.platform, args.navigateToLogin)
  })
}
