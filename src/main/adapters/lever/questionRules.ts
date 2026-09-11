/**
 * Lever's own question-matching rules - a small, independent set scoped to
 * the custom-question phrasings actually seen on real Lever boards
 * (bazaarvoice, sonatype, turvo), not a port of LinkedIn's applyRules.ts.
 * Lever's questions are free-text per-posting custom cards, not a fixed
 * catalog of known LinkedIn Easy Apply prompts, so this stays intentionally
 * short - it grows as new phrasings are seen live, rather than trying to
 * anticipate every possible question up front.
 */
import type { AnswerBank } from '../../config/answerBank'

export interface LeverRule {
  re: RegExp
  value: string
}

function computeNoticeDays(lastWorkingDayStr: string): number {
  const last = new Date(lastWorkingDayStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.max(Math.round((last.getTime() - today.getTime()) / 86400000), 0)
}

export function buildLeverRules(answers: AnswerBank): LeverRule[] {
  return [
    // Cross-border work-authorization questions are usually honestly "No"
    // for a candidate who'd need sponsorship - must come before the
    // sponsorship-required rule below since both can match similar text.
    {
      re: /authoriz(e|s)d to work|eligible to work in|right to work in|legally (permitted|entitled) to work|\bwork permit\b/i,
      value: 'No'
    },
    {
      re: /require.{0,20}sponsorship|requiring.{0,20}sponsorship|need.{0,20}sponsorship/i,
      value: 'Yes'
    },
    {
      re: /current or (previous|former) employee|worked here before|previously (employed|worked)/i,
      value: 'No'
    },
    { re: /notice period/i, value: String(computeNoticeDays(answers.last_working_day)) },
    {
      re: /cover letter|why (are|do) you (interested|want)|why this role|tell us (about|more|why)/i,
      value: answers.cover_letter_generic
    },
    {
      re: /years?.{0,30}experience|how many years/i,
      value: String(answers.years_experience_default)
    },
    { re: /current (company|employer)|present company/i, value: answers.current_company },
    { re: /expected.{0,20}(salary|ctc|compensation)/i, value: String(answers.expected_ctc) },
    { re: /current.{0,20}(salary|ctc)/i, value: String(answers.current_ctc) },
    { re: /^linkedin$|linkedin.{0,15}(url|profile)/i, value: answers.linkedin_profile_url }
  ]
}

export function matchLeverRule(rules: LeverRule[], question: string): string | undefined {
  return rules.find((r) => r.re.test(question))?.value
}

/** Exact match first, then substring - Lever dropdown option text is the literal submitted value. */
export function pickDropdownAnswer(optionTexts: string[], desired: string): string | null {
  const norm = desired.trim().toLowerCase()
  const exact = optionTexts.find((t) => t.trim().toLowerCase() === norm)
  if (exact) return exact
  return optionTexts.find((t) => t.toLowerCase().includes(norm)) ?? null
}
