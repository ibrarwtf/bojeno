import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IpcChannels, type ActivateTabArgs } from '../shared/ipc-contract'
import type { ActiveTabUrl, FetchAppliedCountResult, LoginStatus, Platform } from '../shared/types'

const bojenoApi = {
  checkLogin: (platform: Platform): Promise<LoginStatus> => {
    const channel =
      platform === 'linkedin' ? IpcChannels.linkedinCheckLogin : IpcChannels.naukriCheckLogin
    return ipcRenderer.invoke(channel)
  },
  fetchAppliedCount: (platform: Platform): Promise<FetchAppliedCountResult> => {
    if (platform !== 'linkedin') {
      // Naukri's counterpart channel doesn't exist yet — lands with its own issue.
      return Promise.reject(new Error(`fetchAppliedCount is not yet implemented for ${platform}`))
    }
    return ipcRenderer.invoke(IpcChannels.linkedinFetchAppliedCount)
  },
  activateTab: (args: ActivateTabArgs): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.platformActivateTab, args),
  getActiveTabUrl: (): Promise<ActiveTabUrl> =>
    ipcRenderer.invoke(IpcChannels.platformGetActiveTabUrl),
  onActiveTabUrlChanged: (callback: (data: ActiveTabUrl) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: ActiveTabUrl): void => callback(data)
    ipcRenderer.on(IpcChannels.platformActiveTabUrlChanged, listener)
    return () => ipcRenderer.removeListener(IpcChannels.platformActiveTabUrlChanged, listener)
  }
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
