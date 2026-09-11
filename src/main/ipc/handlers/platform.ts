import { ipcMain } from 'electron'
import { IpcChannels, type ActivateTabArgs } from '../../../shared/ipc-contract'
import { activateTab, getActiveTabUrl } from '../../window'

export function registerPlatformHandlers(): void {
  ipcMain.handle(IpcChannels.platformActivateTab, (_event, args: ActivateTabArgs) => {
    activateTab(args.platform, args.navigateToLogin)
  })
  ipcMain.handle(IpcChannels.platformGetActiveTabUrl, () => getActiveTabUrl())
}
