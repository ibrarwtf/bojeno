import type {
  ActiveTabUrl,
  AppliedCountPoint,
  ApplyResult,
  FetchAppliedCountResult,
  FetchRecentAppliedJobsResult,
  JobDetails,
  LoginStatus,
  Platform,
  RunLogRow,
  ScannedJobCard
} from './types'

export const IpcChannels = {
  linkedinCheckLogin: 'linkedin:checkLogin',
  linkedinFetchAppliedCount: 'linkedin:fetchAppliedCount',
  linkedinFetchRecentAppliedJobs: 'linkedin:fetchRecentAppliedJobs',
  linkedinCaptureJobDetails: 'linkedin:captureJobDetails',
  linkedinScanJobs: 'linkedin:scanJobs',
  linkedinApplyToJob: 'linkedin:applyToJob',
  naukriCheckLogin: 'naukri:checkLogin',
  naukriFetchAppliedCount: 'naukri:fetchAppliedCount',
  platformActivateTab: 'platform:activateTab',
  platformGetActiveTabUrl: 'platform:getActiveTabUrl',
  trackerGetAppliedCountHistory: 'tracker:getAppliedCountHistory',
  trackerGetRunLogs: 'tracker:getRunLogs',
  /** One-way, main -> renderer push. Not part of IpcContract's invoke/handle shape. */
  platformActiveTabUrlChanged: 'platform:activeTabUrlChanged'
} as const

export interface ActivateTabArgs {
  platform: Platform
  navigateToLogin?: boolean
}

export interface ScanJobsArgs {
  keywords?: string
  location?: string
}

export interface IpcContract {
  [IpcChannels.linkedinCheckLogin]: {
    args: []
    return: LoginStatus
  }
  [IpcChannels.linkedinFetchAppliedCount]: {
    args: []
    return: FetchAppliedCountResult
  }
  [IpcChannels.linkedinFetchRecentAppliedJobs]: {
    args: []
    return: FetchRecentAppliedJobsResult
  }
  [IpcChannels.naukriCheckLogin]: {
    args: []
    return: LoginStatus
  }
  [IpcChannels.naukriFetchAppliedCount]: {
    args: []
    return: FetchAppliedCountResult
  }
  [IpcChannels.platformActivateTab]: {
    args: [ActivateTabArgs]
    return: void
  }
  [IpcChannels.platformGetActiveTabUrl]: {
    args: []
    return: ActiveTabUrl
  }
  [IpcChannels.trackerGetAppliedCountHistory]: {
    args: []
    return: AppliedCountPoint[]
  }
  [IpcChannels.linkedinCaptureJobDetails]: {
    args: [string]
    return: JobDetails
  }
  [IpcChannels.linkedinScanJobs]: {
    args: [ScanJobsArgs]
    return: ScannedJobCard[]
  }
  [IpcChannels.linkedinApplyToJob]: {
    args: [string, boolean]
    return: ApplyResult
  }
  [IpcChannels.trackerGetRunLogs]: {
    args: []
    return: RunLogRow[]
  }
}
