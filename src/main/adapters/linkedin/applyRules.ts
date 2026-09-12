/**
 * Ported from afterq/tools/apply-easy-apply.mjs's buildRules, pick-option,
 * and match-rule functions. Pure logic only - regex-to-field mappings, not personal
 * values (those come from the caller's AnswerBank, loaded from a gitignored
 * local file - see config/answerBank.ts). Kept verbatim from the original rather than
 * re-derived: each rule's comment documents a real edge case it was written
 * to fix.
 */
import type { AnswerBank } from '../../config/answerBank'

export interface Rule {
  re: RegExp
  value?: string
  fallback?: string
  candidates?: string[]
  kind: 'text' | 'notice' | 'experience' | 'contains' | 'contains-fallback' | 'contains-any'
  days?: number
  years?: number
}

export function computeNoticeDays(lastWorkingDayStr: string): number {
  const last = new Date(lastWorkingDayStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.max(Math.round((last.getTime() - today.getTime()) / 86400000), 0)
}

/**
 * Managerial-language heuristic for "% hands-on technical vs management"
 * questions - reads the job's own posting text, not the modal.
 */
const MANAGERIAL_RE =
  /people manag|direct reports?|manag(e|ing) (a |the )?team|team lead(ership)?\b|leading a team|managerial|line management|performance reviews?/i

export function pickTechnicalPercent(jdText: string, answers: AnswerBank): string {
  return MANAGERIAL_RE.test(jdText || '')
    ? answers.technical_percent_floor
    : answers.technical_percent_default
}

export function buildRules(answers: AnswerBank, jdText: string): Rule[] {
  const noticeDays = computeNoticeDays(answers.last_working_day)
  return [
    // "full numeric" / "in full" phrasing wants 18 LPA written as 1,800,000,
    // not "18" - must come before the plain current-CTC rule below.
    {
      re: /current.{0,20}ctc.{0,60}(full numeric|numeric value|in full)|(full numeric|numeric value|in full).{0,60}current.{0,20}ctc/i,
      value: (Number(answers.current_ctc) * 100000).toLocaleString('en-US'),
      kind: 'text'
    },
    // Allow a qualifier word ("annual", "gross") between "current"/"expected"
    // and "CTC" - a strict two-word phrase missed "expected annual CTC".
    {
      re: /current.{0,15}ctc|last.{0,15}ctc|present.{0,15}ctc|current salary/i,
      value: String(answers.current_ctc),
      kind: 'text'
    },
    {
      re: /expected.{0,20}ctc|expected.{0,20}salary|desired.{0,20}salary|desired.{0,20}compensation|expected.{0,20}compensation|salary expectation/i,
      value: String(answers.expected_ctc),
      kind: 'text'
    },
    // Bare "What is your CTC?" - the rules above only fire with a
    // current/expected qualifier present. Defaults to current CTC.
    { re: /\bctc\b/i, value: String(answers.current_ctc), kind: 'text' },
    // Monthly salary, derived from current_ctc rather than a separate
    // answer-bank value - one number to update.
    {
      re: /current monthly salary|monthly.{0,15}ctc|salary per month/i,
      value: String(Math.round((Number(answers.current_ctc) * 100000) / 12)),
      kind: 'text'
    },
    { re: /notice period/i, value: String(noticeDays), kind: 'notice', days: noticeDays },
    // Bare "NP" abbreviation, phrased as a fixed short-range question,
    // distinct from the dynamically computed full notice period above.
    { re: /\bnp\b/i, value: '10', kind: 'text' },
    { re: /current or (previous|former) employee of/i, value: 'No', kind: 'contains' },
    // Cross-border applications break the generic yes/no default's
    // assumption that "work authorization" is trivially true - it isn't
    // without an employer-sponsored visa. Must come before the
    // sponsorship-required rule below.
    {
      re: /authoriz(e|s)d to work|eligible to work in|right to work in|legally (permitted|entitled) to work|\bwork permit\b|(hold|have).{0,20}(a )?(valid )?work visa/i,
      value: 'No',
      kind: 'contains'
    },
    {
      re: /require.{0,20}sponsorship|requiring.{0,20}sponsorship|requires.{0,20}sponsorship|need.{0,20}sponsorship/i,
      value: 'Yes',
      kind: 'contains'
    },
    { re: /family member[^?]{0,80}(employ|relative)/i, value: 'N/A', kind: 'text' },
    { re: /referred by[^?]{0,60}employee[^?]{0,40}(name|list)/i, value: 'N/A', kind: 'text' },
    {
      re: /location\s*\(city\)|current city|current location|preferred.{0,15}location|which city|city you|^city$|advise your location/i,
      value: answers.current_city,
      kind: 'text'
    },
    {
      re: /%.{0,30}(technical|hands.?on)|technical.{0,30}%|hands.?on.{0,40}management|management.{0,40}hands.?on/i,
      value: pickTechnicalPercent(jdText, answers),
      kind: 'text'
    },
    {
      re: /cover letter|why (are|do) you (interested|want)|why you (are|do)|career aspirations|why this role|tell us (about|more|why)|about yourself|additional information|anything else/i,
      value: answers.cover_letter_generic,
      kind: 'text'
    },
    // Bare "Summary" / "Skill Set" fields - narrow, anchored so they don't
    // swallow an unrelated field that happens to contain the word.
    {
      re: /^summary$|briefly describe your professional experience/i,
      value: answers.professional_summary,
      kind: 'text'
    },
    {
      re: /which professional platforms or products/i,
      value: answers.tools_platforms_answer,
      kind: 'text'
    },
    { re: /^skill\s*set$/i, value: answers.skills_summary, kind: 'text' },
    {
      re: /^linkedin$|linkedin.{0,15}(url|profile)/i,
      value: answers.linkedin_profile_url,
      kind: 'text'
    },
    {
      re: /ai coding tools|adopted ai|ai.{0,10}adoption/i,
      value: answers.ai_adoption_answer,
      kind: 'text'
    },
    {
      re: /architectural decision|architecture decision|technical decision you led|design decision you (led|made)/i,
      value: answers.architecture_decision_answer,
      kind: 'text'
    },
    // Radio, matched by content - hybrid-cadence questions.
    {
      re: /days?\s*(onsite|in.?office|in the office)|onsite.{0,15}days?/i,
      value: answers.hybrid_days_onsite,
      kind: 'contains'
    },
    // Skill-specific years-of-experience questions - narrower than the
    // generic years/experience fallback further below, so these must come
    // first or the generic rule (and, for the LangChain one, the broader
    // agentic-tooling rule right after this block) would answer instead.
    {
      re: /advance(d)?\s*sql|sql\s*exp(?:erience)?|experience.{0,30}sql|sql.{0,30}experience/i,
      value: answers.sql_experience_years,
      kind: 'text'
    },
    {
      re: /data engineering.{0,30}exper|exper.{0,30}data engineering/i,
      value: answers.data_engineering_experience_years,
      kind: 'text'
    },
    // "How many RAG applications have you built/implemented/deployed" -
    // phrased as a count, not a years-of-experience bucket, so plain text.
    {
      re: /\brag\b.{0,80}(built|implement|deploy)|(built|implement|deploy).{0,80}\brag\b/i,
      value: answers.rag_apps_built_count,
      kind: 'text'
    },
    // "How many production/POC projects built with LangChain/LangGraph" -
    // a project count, distinct from the broader agentic-tooling experience
    // bucket rule below (which fires for bare "do you have LangChain
    // experience" style questions). Must come before that rule since both
    // match on the words "langchain"/"langgraph".
    {
      re: /(langchain|langgraph).{0,80}(built|implement|deploy|projects?)|(built|implement|deploy|projects?).{0,80}(langchain|langgraph)/i,
      value: answers.langchain_projects_built_count,
      kind: 'text'
    },
    // Radio, bucket-fit by numeric range since option wording varies.
    // AI/agentic tooling gets the more honest experience bucket;
    // everything else falls through to the broader default below.
    {
      re: /\bagents?\b|langgraph|langchain|orchestration|tool.?calling|evaluation.?driven development|llm.?as.?judge|trajectory evaluation|observability|tracing|instrumentation|langfuse|opentelemetry/i,
      value: answers.llm_agent_experience,
      kind: 'experience',
      years: 1.5
    },
    {
      re: /how much professional .{0,40}experience do you have/i,
      value: String(answers.years_experience_default),
      kind: 'experience',
      years: parseInt(answers.years_experience_default, 10)
    },
    // General "how many years have you spent <doing X>" fallback that
    // doesn't contain the word "experience" itself.
    {
      re: /how many years (have you|do you have)/i,
      value: String(answers.years_experience_default),
      kind: 'experience',
      years: parseInt(answers.years_experience_default, 10)
    },
    {
      re: /team size|largest team (managed|led)|team you.{0,10}managed/i,
      value: answers.team_size_answer,
      kind: 'text'
    },
    {
      re: /years?[^?]{0,60}exp(?:erience|ecrience)|exp(?:erience|ecrience)[^?]{0,60}years?|overall.{0,20}experience|total.{0,20}experience|^experience$|\bexp\b/i,
      value: String(answers.years_experience_default),
      kind: 'experience',
      years: parseInt(answers.years_experience_default, 10)
    },
    {
      re: /current company|present company|current employer|employer name|^company name$/i,
      value: answers.current_company,
      kind: 'text'
    },
    { re: /^street$|street address/i, value: answers.current_area, kind: 'text' },
    { re: /^province$|^state$/i, value: answers.current_state, kind: 'text' },
    { re: /postal code|zip code|^zip$|pin code/i, value: answers.postal_code, kind: 'text' },
    { re: /^country$/i, value: answers.current_country, kind: 'text' },
    { re: /nationality|citizenship/i, value: answers.nationality, kind: 'text' },
    {
      re: /english.{0,20}(level|proficiency|fluency)|spoken and written english/i,
      value: answers.english_level,
      kind: 'contains'
    },
    {
      re: /race\s*\/?\s*ethnicity|\bethnicity\b/i,
      value: answers.ethnicity,
      fallback: answers.ethnicity_fallback,
      kind: 'contains-fallback'
    },
    // Not anchored: label text arrives doubled ("GenderGender", visible +
    // accessible-name duplication seen elsewhere), so a plain substring
    // check is what actually matches it.
    { re: /gender/i, value: answers.gender, kind: 'contains' },
    { re: /disability/i, value: answers.disability, kind: 'contains' },
    { re: /veteran/i, value: answers.veteran, kind: 'contains' },
    {
      re: /areas?.{0,60}experience|domain.{0,20}experience|which area.{0,20}experience/i,
      candidates: ['AI', 'Machine Learning', 'ML', 'Data', 'GenAI', 'Software', 'Backend'],
      kind: 'contains-any'
    },
    {
      re: /education.{0,20}(level|completed)|highest.{0,20}education/i,
      value: answers.education_level,
      kind: 'contains'
    },
    { re: /\brsu\b/i, value: String(answers.rsu), kind: 'text' }
  ]
}

export function matchRule(rules: Rule[], label: string): Rule | undefined {
  return rules.find((r) => r.re.test(label))
}

/** "Immediate", "15 days", "30 days", ... - picks the smallest bucket >= days. */
export function pickNoticeOption(optionTexts: string[], days: number): string | null {
  const buckets = optionTexts
    .map((t) => {
      if (/immediate/i.test(t)) return { text: t, d: 0 }
      const m = /(\d+)/.exec(t)
      return m ? { text: t, d: parseInt(m[1], 10) } : null
    })
    .filter((x): x is { text: string; d: number } => x !== null)
    .sort((a, b) => a.d - b.d)
  if (!buckets.length) return null
  return (buckets.find((b) => b.d >= days) ?? buckets[buckets.length - 1]).text
}

/**
 * Experience-level buckets are RANGES, not thresholds - picks the option
 * whose range contains `years`, falling back to the closest by midpoint.
 */
export function pickExperienceOption(optionTexts: string[], years: number): string | null {
  const parsed = optionTexts
    .map((t) => {
      const range = /(\d+)\s*-\s*(\d+)/.exec(t)
      if (range) return { text: t, lo: +range[1], hi: +range[2] }
      const plus = /(\d+)\s*\+/.exec(t)
      if (plus) return { text: t, lo: +plus[1], hi: Infinity }
      const under = /less than\s*(\d+)|under\s*(\d+)|<\s*(\d+)/i.exec(t)
      if (under) {
        const n = Number(under[1] || under[2] || under[3])
        return { text: t, lo: 0, hi: n }
      }
      const single = /^\D*(\d+)\D*$/.exec(t.trim())
      if (single) return { text: t, lo: +single[1], hi: +single[1] }
      return null
    })
    .filter((x): x is { text: string; lo: number; hi: number } => x !== null)
  if (!parsed.length) return null
  const contains = parsed.find((p) => years >= p.lo && years <= p.hi)
  if (contains) return contains.text
  const mid = (p: { lo: number; hi: number }): number =>
    p.hi === Infinity ? p.lo + 10 : (p.lo + p.hi) / 2
  parsed.sort((a, b) => Math.abs(mid(a) - years) - Math.abs(mid(b) - years))
  return parsed[0].text
}

/** Content-based since the question is sometimes phrased without "notice period" at all. */
export function looksLikeNoticeOptions(optionTexts: string[]): boolean {
  return (
    optionTexts.some((t) => /immediate/i.test(t)) &&
    optionTexts.some((t) => /\d/.test(t) || /serving/i.test(t))
  )
}

/** True if the option set is structurally just Yes/No (ignoring the placeholder). */
export function yesNoOptionMatch(optionTexts: string[], wantYes: boolean): string | null {
  const norm = optionTexts
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t && !/^select an option$/i.test(t))
  const set = new Set(norm)
  if (set.size !== 2 || !set.has('yes') || !set.has('no')) return null
  const target = wantYes ? 'yes' : 'no'
  return optionTexts.find((t) => t.trim().toLowerCase() === target) ?? null
}

/**
 * Resolves a matched rule against an option list (select or radio-label
 * text). 'contains'/'contains-fallback' pick the option that best NAMES
 * the answer (English level, ethnicity) rather than one with an exact
 * known value.
 */
export function pickOptionByRule(optionTexts: string[], rule: Rule): string | null {
  if (rule.kind === 'notice') return pickNoticeOption(optionTexts, rule.days ?? 0)
  if (rule.kind === 'experience') return pickExperienceOption(optionTexts, rule.years ?? 0)
  if (rule.kind === 'contains-any') {
    for (const c of rule.candidates ?? []) {
      const hit = optionTexts.find((t) => t.toLowerCase().includes(c.toLowerCase()))
      if (hit) return hit
    }
    return null
  }
  if (rule.kind === 'contains' || rule.kind === 'contains-fallback') {
    const hit = optionTexts.find((t) => t.toLowerCase().includes(String(rule.value).toLowerCase()))
    if (hit) return hit
    if (rule.kind === 'contains-fallback') {
      return (
        optionTexts.find((t) => t.toLowerCase().includes(String(rule.fallback).toLowerCase())) ??
        null
      )
    }
    return null
  }
  return (
    optionTexts.find((t) => t.trim().toLowerCase() === String(rule.value).toLowerCase()) ?? null
  )
}
