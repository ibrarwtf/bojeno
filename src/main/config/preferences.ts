import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { TitleFilterConfig } from '../adapters/linkedin/titleFilter'

/**
 * User-tunable job-filtering thresholds - kept out of code the same way
 * AnswerBank is (see answerBank.ts): real values live in
 * .local/preferences.json (gitignored, never committed), preferences.example.json
 * at the repo root is the tracked template. Nothing in the apply pipeline
 * should hardcode a number like "skip over 100 applicants" - it reads from here.
 */
export interface JobFilterPreferences {
  /** Skip a posting whose rough top-card figure ("Over 100 applicants", "47 applicants")
   *  is at or above this. Absent/undefined = no cap from this field. */
  maxApplicantCount?: number
  /** Skip a posting whose premium "Applicants for this job" total is at or
   *  above this - a more precise cut than maxApplicantCount when both are
   *  present on the same posting, since it isn't rounded to "Over N". */
  maxApplicantInsightTotal?: number
  /** Skip a posting whose JD-parsed years-of-experience requirement exceeds
   *  this. Absent/undefined = no cap; null yearsRequired (JD didn't mention
   *  a number) never triggers this, only a parsed number over the cap does. */
  maxYearsRequired?: number
  /** Card-level title relevance gate, checked before ever opening a
   *  posting - see titleFilter.ts. Absent/undefined = every title passes. */
  titleFilter?: TitleFilterConfig
  /** Skip a posting whose fit-card tier (details.fitTier - see
   *  jobDetails.ts's parseFitTier) isn't 'top' or 'high' - LinkedIn's own
   *  "You'd be a top applicant" / "Job match is high" wording, live-verified
   *  2026-09-13. A posting with no fit card, or a fit card with different
   *  ('generic') wording, is skipped too. Absent/undefined = fit tier
   *  doesn't gate anything. */
  requireFitSignal?: boolean
}

const PREFERENCES_PATH = join(process.cwd(), '.local', 'preferences.json')

/** No preferences file yet is a valid state (no filtering applied), unlike
 *  the answer bank which is required - filtering is opt-in. */
export function loadPreferences(): JobFilterPreferences {
  if (!existsSync(PREFERENCES_PATH)) return {}
  return JSON.parse(readFileSync(PREFERENCES_PATH, 'utf-8')) as JobFilterPreferences
}
