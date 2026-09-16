import type { JobDetails } from '../../../shared/types'
import type { JobFilterPreferences } from '../../config/preferences'
import { parseApplicantCountNumber } from './jobDetails'

/**
 * Returns a skip reason when a posting exceeds the user's own
 * applicant-volume thresholds (loaded from preferences.ts, never hardcoded
 * here), or undefined when it's within them - including when no preference
 * is set for the field in question at all.
 */
export function evaluateApplicantPreference(
  details: JobDetails,
  preferences: JobFilterPreferences
): string | undefined {
  const roughCount = parseApplicantCountNumber(details.applicantCount)
  if (
    preferences.maxApplicantCount !== undefined &&
    roughCount !== null &&
    roughCount >= preferences.maxApplicantCount
  ) {
    return `applicant count "${details.applicantCount}" meets preference cap of ${preferences.maxApplicantCount}`
  }

  const total = details.applicantInsightCounts?.total ?? null
  if (
    preferences.maxApplicantInsightTotal !== undefined &&
    total !== null &&
    total >= preferences.maxApplicantInsightTotal
  ) {
    return `applicant insight total ${total} meets preference cap of ${preferences.maxApplicantInsightTotal}`
  }

  if (
    preferences.maxYearsRequired !== undefined &&
    details.yearsRequired !== null &&
    details.yearsRequired > preferences.maxYearsRequired
  ) {
    return `JD requires ${details.yearsRequired} years, over preference cap of ${preferences.maxYearsRequired}`
  }

  if (preferences.requireFitSignal && details.fitTier !== 'top' && details.fitTier !== 'high') {
    return `fit tier "${details.fitTier ?? 'none'}" is not top/high`
  }

  return undefined
}
