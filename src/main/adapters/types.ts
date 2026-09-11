import type { ApplicationMetrics, LoginStatus, ScrapedJob } from '../../shared/types'

export type Capability =
  | 'checkLogin'
  | 'appliedCount'
  | 'recentAppliedJobs'
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
}
