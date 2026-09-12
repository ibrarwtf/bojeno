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
  SearchUrlParams,
  SequentialRunSummary
} from './types'

export const IpcChannels = {
  linkedinCheckLogin: 'linkedin:checkLogin',
  linkedinFetchAppliedCount: 'linkedin:fetchAppliedCount',
  linkedinFetchRecentAppliedJobs: 'linkedin:fetchRecentAppliedJobs',
  linkedinCaptureJobDetails: 'linkedin:captureJobDetails',
  linkedinScanJobs: 'linkedin:scanJobs',
  linkedinApplyToJob: 'linkedin:applyToJob',
  linkedinRunSequentialSearch: 'linkedin:runSequentialSearch',
  linkedinSavedSearchesList: 'linkedin:savedSearches:list',
  linkedinSavedSearchesCreate: 'linkedin:savedSearches:create',
  linkedinSavedSearchesDelete: 'linkedin:savedSearches:delete',
  linkedinSavedSearchesTouchRun: 'linkedin:savedSearches:touchRun',
  naukriCheckLogin: 'naukri:checkLogin',
  platformActivateTab: 'platform:activateTab',
  platformShowHome: 'platform:showHome',
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

export type ScanJobsArgs = SearchUrlParams

export interface RunSequentialSearchArgs {
  params: SearchUrlParams
  dryRun: boolean
}

export interface CreateSavedSearchArgs {
  name: string
  keywords?: string
  location?: string
  geoId?: string
  distanceKm?: number
  sortByRecent?: boolean
  easyApplyOnly?: boolean
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
  [IpcChannels.platformActivateTab]: {
    args: [ActivateTabArgs]
    return: void
  }
  [IpcChannels.platformShowHome]: {
    args: []
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
  [IpcChannels.linkedinRunSequentialSearch]: {
    args: [RunSequentialSearchArgs]
    return: SequentialRunSummary
  }
  [IpcChannels.trackerGetRunLogs]: {
    args: []
    return: RunLogRow[]
  }
  [IpcChannels.linkedinSavedSearchesList]: {
    args: []
    return: LinkedinSavedSearch[]
  }
  [IpcChannels.linkedinSavedSearchesCreate]: {
    args: [CreateSavedSearchArgs]
    return: LinkedinSavedSearch
  }
  [IpcChannels.linkedinSavedSearchesDelete]: {
    args: [number]
    return: void
  }
  [IpcChannels.linkedinSavedSearchesTouchRun]: {
    args: [number]
    return: void
  }
}
