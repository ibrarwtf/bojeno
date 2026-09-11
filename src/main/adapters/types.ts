import type { ApplicationMetrics, LoginStatus } from '../../shared/types'

export type Capability =
  | 'checkLogin'
  | 'appliedCount'
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
}
