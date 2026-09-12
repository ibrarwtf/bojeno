import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  IpcChannels,
  type ActivateTabArgs,
  type CreateSavedSearchArgs,
  type RunSequentialSearchArgs,
  type ScanJobsArgs
} from '../shared/ipc-contract'
import type {
  ActiveTabUrl,
  AppliedCountPoint,
  ApplyResult,
  FetchAppliedCountResult,
  FetchRecentAppliedJobsResult,
  JobDetails,
  LinkedinSavedSearch,
  LoginStatus,
  Platform,
  RunLogRow,
  ScannedJobCard,
  SequentialRunSummary,
  UnmatchedQuestionRow
} from '../shared/types'

const bojenoApi = {
  checkLogin: (platform: Platform): Promise<LoginStatus> => {
    const channel =
      platform === 'linkedin' ? IpcChannels.linkedinCheckLogin : IpcChannels.naukriCheckLogin
    return ipcRenderer.invoke(channel)
  },
  fetchAppliedCount: (platform: Platform): Promise<FetchAppliedCountResult> => {
    if (platform !== 'linkedin') {
      return Promise.reject(new Error(`fetchAppliedCount is not available for ${platform}`))
    }
    return ipcRenderer.invoke(IpcChannels.linkedinFetchAppliedCount)
  },
  fetchRecentAppliedJobs: (platform: Platform): Promise<FetchRecentAppliedJobsResult> => {
    if (platform !== 'linkedin') {
      return Promise.reject(new Error(`fetchRecentAppliedJobs is not available for ${platform}`))
    }
    return ipcRenderer.invoke(IpcChannels.linkedinFetchRecentAppliedJobs)
  },
  activateTab: (args: ActivateTabArgs): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.platformActivateTab, args),
  showHome: (): Promise<void> => ipcRenderer.invoke(IpcChannels.platformShowHome),
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
  resolveCompanyId: (name: string): Promise<string | null> =>
    ipcRenderer.invoke(IpcChannels.linkedinResolveCompanyId, name),
  applyToJob: (jobId: string, dryRun = true): Promise<ApplyResult> =>
    ipcRenderer.invoke(IpcChannels.linkedinApplyToJob, jobId, dryRun),
  runSequentialSearch: (args: RunSequentialSearchArgs): Promise<SequentialRunSummary> =>
    ipcRenderer.invoke(IpcChannels.linkedinRunSequentialSearch, args),
  cancelRun: (runId: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.linkedinCancelRun, runId),
  getRunLogs: (): Promise<RunLogRow[]> => ipcRenderer.invoke(IpcChannels.trackerGetRunLogs),
  getUnmatchedQuestions: (): Promise<UnmatchedQuestionRow[]> =>
    ipcRenderer.invoke(IpcChannels.trackerGetUnmatchedQuestions),
  resolveUnmatchedQuestion: (id: number, answer: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.trackerResolveUnmatchedQuestion, id, answer),
  /** Manual verification helper for #83 - inserts a throwaway unresolved row
   *  and fires the real notification path. See devcheck usage in the
   *  #83 issue/PR notes. */
  createTestUnmatchedQuestion: (): Promise<boolean> =>
    ipcRenderer.invoke(IpcChannels.trackerCreateTestUnmatchedQuestion),
  listSavedSearches: (): Promise<LinkedinSavedSearch[]> =>
    ipcRenderer.invoke(IpcChannels.linkedinSavedSearchesList),
  createSavedSearch: (args: CreateSavedSearchArgs): Promise<LinkedinSavedSearch> =>
    ipcRenderer.invoke(IpcChannels.linkedinSavedSearchesCreate, args),
  deleteSavedSearch: (id: number): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.linkedinSavedSearchesDelete, id),
  touchSavedSearchLastRun: (id: number): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.linkedinSavedSearchesTouchRun, id)
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
