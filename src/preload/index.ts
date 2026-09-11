import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  IpcChannels,
  type ActivateTabArgs,
  type AtsDiscoverArgs,
  type ScanJobsArgs
} from '../shared/ipc-contract'
import type {
  ActiveTabUrl,
  AppliedCountPoint,
  ApplyResult,
  DiscoverResult,
  FetchAppliedCountResult,
  FetchRecentAppliedJobsResult,
  JobDetails,
  LoginStatus,
  Platform,
  RunLogRow,
  ScannedJobCard
} from '../shared/types'

const bojenoApi = {
  checkLogin: (platform: Platform): Promise<LoginStatus> => {
    const channel =
      platform === 'linkedin' ? IpcChannels.linkedinCheckLogin : IpcChannels.naukriCheckLogin
    return ipcRenderer.invoke(channel)
  },
  fetchAppliedCount: (platform: Platform): Promise<FetchAppliedCountResult> => {
    const channel =
      platform === 'linkedin'
        ? IpcChannels.linkedinFetchAppliedCount
        : IpcChannels.naukriFetchAppliedCount
    return ipcRenderer.invoke(channel)
  },
  fetchRecentAppliedJobs: (platform: Platform): Promise<FetchRecentAppliedJobsResult> => {
    if (platform !== 'linkedin') {
      return Promise.reject(new Error(`fetchRecentAppliedJobs is not available for ${platform}`))
    }
    return ipcRenderer.invoke(IpcChannels.linkedinFetchRecentAppliedJobs)
  },
  activateTab: (args: ActivateTabArgs): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.platformActivateTab, args),
  getActiveTabUrl: (): Promise<ActiveTabUrl> =>
    ipcRenderer.invoke(IpcChannels.platformGetActiveTabUrl),
  onActiveTabUrlChanged: (callback: (data: ActiveTabUrl) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: ActiveTabUrl): void => callback(data)
    ipcRenderer.on(IpcChannels.platformActiveTabUrlChanged, listener)
    return () => ipcRenderer.removeListener(IpcChannels.platformActiveTabUrlChanged, listener)
  },
  getAppliedCountHistory: (): Promise<AppliedCountPoint[]> =>
    ipcRenderer.invoke(IpcChannels.trackerGetAppliedCountHistory),
  captureJobDetails: (jobUrl: string): Promise<JobDetails> =>
    ipcRenderer.invoke(IpcChannels.linkedinCaptureJobDetails, jobUrl),
  scanJobs: (params: ScanJobsArgs): Promise<ScannedJobCard[]> =>
    ipcRenderer.invoke(IpcChannels.linkedinScanJobs, params),
  applyToJob: (jobId: string, dryRun = true): Promise<ApplyResult> =>
    ipcRenderer.invoke(IpcChannels.linkedinApplyToJob, jobId, dryRun),
  getRunLogs: (): Promise<RunLogRow[]> => ipcRenderer.invoke(IpcChannels.trackerGetRunLogs),
  discover: (args: AtsDiscoverArgs): Promise<DiscoverResult> =>
    ipcRenderer.invoke(IpcChannels.atsDiscover, args)
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
