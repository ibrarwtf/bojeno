import { describe, it, expect } from 'vitest'
import { evaluateApplicantPreference } from './preferencesGate'
import type { JobDetails } from '../../../shared/types'

function makeDetails(overrides: Partial<JobDetails> = {}): JobDetails {
  return {
    jobUrl: 'https://www.linkedin.com/jobs/view/1/',
    company: 'Acme',
    companyUrl: null,
    title: 'Engineer',
    postedRelative: null,
    clickedApplyCount: null,
    applicantCount: null,
    hasFitSignal: false,
    fitTier: null,
    yearsRequired: null,
    descriptionText: '',
    applicantInsightsText: null,
    applicantInsightCounts: null,
    contactEmails: [],
    contactPhones: [],
    jobPosterName: null,
    jobPosterTitle: null,
    jobPosterProfileUrl: null,
    ...overrides
  }
}

describe('evaluateApplicantPreference', () => {
  it('returns undefined when no preferences are set', () => {
    const details = makeDetails({ applicantCount: 'Over 500' })
    expect(evaluateApplicantPreference(details, {})).toBeUndefined()
  })

  it('skips when the rough applicant count meets the maxApplicantCount cap', () => {
    const details = makeDetails({ applicantCount: 'Over 100' })
    expect(evaluateApplicantPreference(details, { maxApplicantCount: 100 })).toMatch(
      /applicant count "Over 100" meets preference cap of 100/
    )
  })

  it('does not skip when the rough count is below the cap', () => {
    const details = makeDetails({ applicantCount: '47' })
    expect(evaluateApplicantPreference(details, { maxApplicantCount: 100 })).toBeUndefined()
  })

  it('skips when the premium insight total meets maxApplicantInsightTotal', () => {
    const details = makeDetails({ applicantInsightCounts: { total: 356, pastDay: 283 } })
    expect(evaluateApplicantPreference(details, { maxApplicantInsightTotal: 200 })).toMatch(
      /applicant insight total 356 meets preference cap of 200/
    )
  })

  it('does not skip when the insight total is below the cap', () => {
    const details = makeDetails({ applicantInsightCounts: { total: 50, pastDay: 10 } })
    expect(evaluateApplicantPreference(details, { maxApplicantInsightTotal: 200 })).toBeUndefined()
  })

  it('does not skip when the relevant field is simply absent', () => {
    const details = makeDetails({ applicantCount: null, applicantInsightCounts: null })
    expect(
      evaluateApplicantPreference(details, {
        maxApplicantCount: 100,
        maxApplicantInsightTotal: 200
      })
    ).toBeUndefined()
  })
})
