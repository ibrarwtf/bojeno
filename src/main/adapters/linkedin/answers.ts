import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Field names only, no values - the shape mirrors afterq/tools's
 * easy-apply-answers.yml. Real values live in .local/easy-apply-answers.json
 * (gitignored, never committed - this is the public bojeno repo) and are
 * never checked in; easy-apply-answers.example.json at the repo root is the
 * tracked template with placeholder values.
 */
export interface AnswerBank {
  current_ctc: number
  expected_ctc: number
  last_working_day: string
  current_city: string
  current_area: string
  current_state: string
  current_country: string
  postal_code: string
  nationality: string
  english_level: string
  ethnicity: string
  ethnicity_fallback: string
  gender: string
  disability: string
  veteran: string
  education_level: string
  rsu: number
  technical_percent_floor: string
  technical_percent_default: string
  cover_letter_generic: string
  professional_summary: string
  tools_platforms_answer: string
  skills_summary: string
  linkedin_profile_url: string
  ai_adoption_answer: string
  architecture_decision_answer: string
  hybrid_days_onsite: string
  llm_agent_experience: string
  years_experience_default: string
  team_size_answer: string
  current_company: string
}

const ANSWERS_PATH = join(process.cwd(), '.local', 'easy-apply-answers.json')

export function loadAnswerBank(): AnswerBank {
  if (!existsSync(ANSWERS_PATH)) {
    throw new Error(
      `No answer bank found at ${ANSWERS_PATH}. Copy easy-apply-answers.example.json there and fill in your real values (this path is gitignored).`
    )
  }
  return JSON.parse(readFileSync(ANSWERS_PATH, 'utf-8')) as AnswerBank
}
