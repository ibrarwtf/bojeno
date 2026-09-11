import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IpcChannels, type ActivateTabArgs } from '../shared/ipc-contract'
import type { LoginStatus, Platform } from '../shared/types'

const bojenoApi = {
  checkLogin: (platform: Platform): Promise<LoginStatus> => {
    const channel =
      platform === 'linkedin' ? IpcChannels.linkedinCheckLogin : IpcChannels.naukriCheckLogin
    return ipcRenderer.invoke(channel)
  },
  activateTab: (args: ActivateTabArgs): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.platformActivateTab, args)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('bojeno', bojenoApi)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.bojeno = bojenoApi
}

export type BojenoApi = typeof bojenoApi
