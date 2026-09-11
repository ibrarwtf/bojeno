import type {
  ApplicationMetrics,
  ApplyResult,
  JobDetails,
  LoginStatus,
  ScannedJobCard,
  ScrapedJob
} from '../../shared/types'

export type Capability =
  | 'checkLogin'
  | 'appliedCount'
  | 'recentAppliedJobs'
  | 'captureJobDetails'
  | 'scanJobs'
  | 'discover'
  | 'apply'
  | 'findCompany'
  | 'findInsiders'
  | 'findHiringPosts'
  | 'connect'
  | 'askReferral'

export interface Adapter {
  id: string
  kind: 'session' | 'api'
  capabilities: Set<Capability>
  checkLogin?(): Promise<LoginStatus>
  appliedCount?(): Promise<ApplicationMetrics>
  recentAppliedJobs?(): Promise<ScrapedJob[]>
  captureJobDetails?(jobUrl: string): Promise<JobDetails>
  scanJobs?(params: { keywords?: string; location?: string }): Promise<ScannedJobCard[]>
  applyToJob?(jobId: string, dryRun?: boolean): Promise<ApplyResult>
}
