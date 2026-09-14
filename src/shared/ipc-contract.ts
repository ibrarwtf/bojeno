import type {
  ActiveTabUrl,
  AppliedCountPoint,
  ApplyResult,
  CreatePipelineContactArgs,
  FetchAppliedCountResult,
  FetchRecentAppliedJobsResult,
  JobDetails,
  LinkedinSavedSearch,
  LoginStatus,
  PipelineContactRow,
  Platform,
  RunLogRow,
  ScannedJobCard,
  SearchUrlParams,
  SequentialRunSummary,
  UnmatchedQuestionRow,
  UpdatePipelineContactArgs
} from './types'

export const IpcChannels = {
  linkedinCheckLogin: 'linkedin:checkLogin',
  linkedinFetchAppliedCount: 'linkedin:fetchAppliedCount',
  linkedinFetchRecentAppliedJobs: 'linkedin:fetchRecentAppliedJobs',
  linkedinCaptureJobDetails: 'linkedin:captureJobDetails',
  linkedinScanJobs: 'linkedin:scanJobs',
  linkedinResolveCompanyId: 'linkedin:resolveCompanyId',
  linkedinApplyToJob: 'linkedin:applyToJob',
  linkedinRunSequentialSearch: 'linkedin:runSequentialSearch',
  linkedinCancelRun: 'linkedin:cancelRun',
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
  trackerGetUnmatchedQuestions: 'tracker:getUnmatchedQuestions',
  trackerResolveUnmatchedQuestion: 'tracker:resolveUnmatchedQuestion',
  trackerCreateTestUnmatchedQuestion: 'tracker:createTestUnmatchedQuestion',
  trackerGetApplyRate: 'tracker:getApplyRate',
  pipelineListContacts: 'pipeline:listContacts',
  pipelineCreateContact: 'pipeline:createContact',
  pipelineUpdateContact: 'pipeline:updateContact',
  pipelineDeleteContact: 'pipeline:deleteContact',
  pipelineListFollowUpsDue: 'pipeline:listFollowUpsDue',
  /** One-way, main -> renderer push. Not part of IpcContract's invoke/handle shape. */
  platformActiveTabUrlChanged: 'platform:activeTabUrlChanged'
} as const

export interface ActivateTabArgs {
  platform: Platform
  navigateToLogin?: boolean
}

export type ScanJobsArgs = SearchUrlParams

export interface RunSequentialSearchArgs {
  /** Caller-generated, known before the run starts - the only way a Stop
   *  button can target a run that's still in flight, since the run's own
   *  IPC call doesn't resolve until it's done. */
  runId: string
  params: SearchUrlParams
  dryRun: boolean
  /** The saved search's own name, purely for the run-log summary row's
   *  display - an ad-hoc/manual run (none exists yet) simply omits it. */
  savedSearchName?: string
  /** Caps how many results pages this run walks before stopping on its own -
   *  for trying out a query variant without a full unbounded run. Absent =
   *  runSequentialSearch's own default ceiling (MAX_PAGES). */
  maxPages?: number
  /** Caps how many real applications (applied + dryRunApplied combined) this
   *  run submits before stopping itself early, same as a user hitting Stop -
   *  a per-run safety bound distinct from maxPages, since a search can run
   *  out of pages long before it runs out of jobs worth applying to. Absent
   *  = no cap from this field. */
  maxApplications?: number
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
  [IpcChannels.linkedinResolveCompanyId]: {
    args: [name: string]
    return: string | null
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
  [IpcChannels.linkedinCancelRun]: {
    args: [string]
    return: void
  }
  [IpcChannels.trackerGetRunLogs]: {
    args: []
    return: RunLogRow[]
  }
  [IpcChannels.trackerGetUnmatchedQuestions]: {
    args: []
    return: UnmatchedQuestionRow[]
  }
  [IpcChannels.trackerResolveUnmatchedQuestion]: {
    args: [id: number, answer: string]
    return: void
  }
  /** Manual verification helper for the #83 notification - inserts a
   *  throwaway unresolved row (a fresh external_job_id each call, so it
   *  always fires) and returns whether a real OS notification went out. */
  [IpcChannels.trackerCreateTestUnmatchedQuestion]: {
    args: []
    return: boolean
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
  [IpcChannels.pipelineListContacts]: {
    args: []
    return: PipelineContactRow[]
  }
  [IpcChannels.pipelineCreateContact]: {
    args: [CreatePipelineContactArgs]
    return: PipelineContactRow
  }
  [IpcChannels.pipelineUpdateContact]: {
    args: [UpdatePipelineContactArgs]
    return: void
  }
  [IpcChannels.pipelineDeleteContact]: {
    args: [id: number]
    return: void
  }
  [IpcChannels.pipelineListFollowUpsDue]: {
    args: []
    return: PipelineContactRow[]
  }
}
