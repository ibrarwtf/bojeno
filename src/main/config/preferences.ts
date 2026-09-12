import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

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
}

const PREFERENCES_PATH = join(process.cwd(), '.local', 'preferences.json')

/** No preferences file yet is a valid state (no filtering applied), unlike
 *  the answer bank which is required - filtering is opt-in. */
export function loadPreferences(): JobFilterPreferences {
  if (!existsSync(PREFERENCES_PATH)) return {}
  return JSON.parse(readFileSync(PREFERENCES_PATH, 'utf-8')) as JobFilterPreferences
}
