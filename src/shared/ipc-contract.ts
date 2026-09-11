import type {
  ActiveTabUrl,
  AppliedCountPoint,
  FetchAppliedCountResult,
  FetchRecentAppliedJobsResult,
  LoginStatus,
  Platform
} from './types'

export const IpcChannels = {
  linkedinCheckLogin: 'linkedin:checkLogin',
  linkedinFetchAppliedCount: 'linkedin:fetchAppliedCount',
  linkedinFetchRecentAppliedJobs: 'linkedin:fetchRecentAppliedJobs',
  naukriCheckLogin: 'naukri:checkLogin',
  naukriFetchAppliedCount: 'naukri:fetchAppliedCount',
  platformActivateTab: 'platform:activateTab',
  platformGetActiveTabUrl: 'platform:getActiveTabUrl',
  trackerGetAppliedCountHistory: 'tracker:getAppliedCountHistory',
  /** One-way, main -> renderer push. Not part of IpcContract's invoke/handle shape. */
  platformActiveTabUrlChanged: 'platform:activeTabUrlChanged'
} as const

export interface ActivateTabArgs {
  platform: Platform
  navigateToLogin?: boolean
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
}
