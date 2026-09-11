import type { ActiveTabUrl, FetchAppliedCountResult, LoginStatus, Platform } from './types'

export const IpcChannels = {
  linkedinCheckLogin: 'linkedin:checkLogin',
  linkedinFetchAppliedCount: 'linkedin:fetchAppliedCount',
  naukriCheckLogin: 'naukri:checkLogin',
  platformActivateTab: 'platform:activateTab',
  platformGetActiveTabUrl: 'platform:getActiveTabUrl',
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
  [IpcChannels.naukriCheckLogin]: {
    args: []
    return: LoginStatus
  }
  [IpcChannels.platformActivateTab]: {
    args: [ActivateTabArgs]
    return: void
  }
  [IpcChannels.platformGetActiveTabUrl]: {
    args: []
    return: ActiveTabUrl
  }
}
