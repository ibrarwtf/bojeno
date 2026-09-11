import type { LoginStatus, Platform } from './types'

export const IpcChannels = {
  linkedinCheckLogin: 'linkedin:checkLogin',
  naukriCheckLogin: 'naukri:checkLogin',
  platformActivateTab: 'platform:activateTab'
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
  [IpcChannels.naukriCheckLogin]: {
    args: []
    return: LoginStatus
  }
  [IpcChannels.platformActivateTab]: {
    args: [ActivateTabArgs]
    return: void
  }
}
