import { describe, it, expect } from 'vitest'
import {
  buildRules,
  matchRule,
  computeNoticeDays,
  pickTechnicalPercent,
  pickNoticeOption,
  pickExperienceOption,
  looksLikeNoticeOptions,
  yesNoOptionMatch,
  pickOptionByRule
} from './applyRules'
import type { AnswerBank } from '../../config/answerBank'

const ANSWERS: AnswerBank = {
  full_name: 'Test User',
  email: 'test@example.com',
  phone: '+91 9999999999',
  resume_path: '/tmp/resume.pdf',
  current_ctc: 18,
  expected_ctc: 24,
  last_working_day: '2099-01-01',
  current_city: 'Bengaluru',
  current_area: 'Indiranagar',
  current_state: 'Karnataka',
  current_country: 'India',
  postal_code: '560001',
  nationality: 'Indian',
  english_level: 'Professional',
  ethnicity: 'Asian',
  ethnicity_fallback: 'Prefer not to say',
  gender: 'Male',
  disability: 'No',
  veteran: 'No',
  education_level: "Bachelor's",
  rsu: 0,
  technical_percent_floor: '80',
  technical_percent_default: '90',
  cover_letter_generic: 'Generic cover letter.',
  professional_summary: 'Summary.',
  tools_platforms_answer: 'Tools.',
  skills_summary: 'Skills.',
  linkedin_profile_url: 'https://linkedin.com/in/test',
  ai_adoption_answer: 'AI adoption.',
  architecture_decision_answer: 'Architecture decision.',
  hybrid_days_onsite: '2 days',
  llm_agent_experience: '1-2 years',
  sql_experience_years: '5 years',
  data_engineering_experience_years: '4 years',
  rag_apps_built_count: '3',
  langchain_projects_built_count: '3',
  years_experience_default: '5',
  team_size_answer: 'None',
  current_company: 'Test Co'
}

describe('computeNoticeDays', () => {
  it('returns 0 for a past/today date, not negative', () => {
    expect(computeNoticeDays('2020-01-01')).toBe(0)
  })
})

describe('pickTechnicalPercent', () => {
  it('picks the floor when the JD reads as managerial', () => {
    expect(pickTechnicalPercent('You will be managing a team of engineers', ANSWERS)).toBe('80')
  })

  it('picks the default when not managerial', () => {
    expect(pickTechnicalPercent('You will write Python code', ANSWERS)).toBe('90')
  })
})

describe('buildRules + matchRule', () => {
  const rules = buildRules(ANSWERS, 'no managerial language here')

  it('matches current CTC and returns the raw value', () => {
    const rule = matchRule(rules, 'What is your current CTC?')
    expect(rule?.value).toBe('18')
  })

  it('matches "full numeric" CTC phrasing before the plain current-CTC rule', () => {
    const rule = matchRule(rules, 'Current CTC (numeric value)')
    expect(rule?.value).toBe((18 * 100000).toLocaleString('en-US'))
  })

  it('matches expected CTC', () => {
    const rule = matchRule(rules, 'What is your expected salary?')
    expect(rule?.value).toBe('24')
  })

  it('matches notice period and computes days dynamically', () => {
    const rule = matchRule(rules, 'What is your notice period?')
    expect(rule?.kind).toBe('notice')
    expect(rule?.days).toBeGreaterThan(0)
  })

  it('answers work-authorization questions honestly as No', () => {
    const rule = matchRule(rules, 'Are you legally authorized to work in this country?')
    expect(rule?.value).toBe('No')
  })

  it('answers sponsorship-required questions as Yes', () => {
    const rule = matchRule(rules, 'Will you require sponsorship to work?')
    expect(rule?.value).toBe('Yes')
  })

  it('returns undefined for an unmatched question', () => {
    expect(matchRule(rules, 'What is your favorite color?')).toBeUndefined()
  })
})

describe('skill-specific experience/count rules', () => {
  const rules = buildRules(ANSWERS, '')

  it('matches the exact "Advance SQL" question', () => {
    const rule = matchRule(rules, 'What is your experience in Advance SQL?')
    expect(rule?.value).toBe('5 years')
  })

  it('matches a rephrased SQL variant without the typo', () => {
    const rule = matchRule(rules, 'How many years of Advanced SQL experience do you have?')
    expect(rule?.value).toBe('5 years')
  })

  it('matches the exact Data Engineering question', () => {
    const rule = matchRule(rules, 'What is experience in Data Engineering?')
    expect(rule?.value).toBe('4 years')
  })

  it('matches a rephrased Data Engineering variant', () => {
    const rule = matchRule(rules, 'Do you have experience with Data Engineering?')
    expect(rule?.value).toBe('4 years')
  })

  it('matches the exact RAG applications question', () => {
    const rule = matchRule(
      rules,
      'How many RAG applications have you personally implemented using LLMs, embeddings, and vector databases?'
    )
    expect(rule?.value).toBe('3')
  })

  it('matches a rephrased RAG variant', () => {
    const rule = matchRule(rules, 'How many RAG apps have you built?')
    expect(rule?.value).toBe('3')
  })

  it('matches the exact LangChain/LangGraph projects question', () => {
    const rule = matchRule(
      rules,
      'How many production or POC projects have you personally built using LangChain and/or LangGraph for Agentic AI?'
    )
    expect(rule?.value).toBe('3')
  })

  it('matches a rephrased LangChain/LangGraph variant without hijacking the broader agentic-experience rule', () => {
    const rule = matchRule(
      rules,
      'Number of LangChain/LangGraph production or POC projects you have built'
    )
    expect(rule?.value).toBe('3')
    expect(rule?.kind).toBe('text')
  })

  it('still lets a bare LangChain experience question fall through to the broader agentic-tooling rule', () => {
    const rule = matchRule(rules, 'What is your experience with LangChain?')
    expect(rule?.value).toBe('1-2 years')
    expect(rule?.kind).toBe('experience')
  })

  it('still lets a bare generic years-of-experience question hit the default rule, not the new SQL rule', () => {
    const rule = matchRule(rules, 'How many years of professional experience do you have?')
    expect(rule?.value).toBe('5')
    expect(rule?.kind).toBe('experience')
  })
})

describe('pickNoticeOption', () => {
  it('picks the smallest bucket >= days', () => {
    const options = ['Immediate', '15 days', '30 days', '60 days', '90+ days']
    expect(pickNoticeOption(options, 20)).toBe('30 days')
  })

  it('falls back to the largest bucket when days exceeds all of them', () => {
    const options = ['Immediate', '15 days', '30 days']
    expect(pickNoticeOption(options, 999)).toBe('30 days')
  })
})

describe('pickExperienceOption', () => {
  it('picks the range containing the years value', () => {
    const options = ['0-2 years', '3-5 years', '5-8 years', '8+ years']
    expect(pickExperienceOption(options, 4)).toBe('3-5 years')
  })

  it('picks the closest range by midpoint when none contains the value', () => {
    const options = ['0-2 years', '8+ years']
    expect(pickExperienceOption(options, 15)).toBe('8+ years')
  })
})

describe('looksLikeNoticeOptions', () => {
  it('detects an immediate + numeric/serving option set', () => {
    expect(looksLikeNoticeOptions(['Immediate', '30', 'Serving'])).toBe(true)
  })

  it('returns false for an unrelated option set', () => {
    expect(looksLikeNoticeOptions(['Yes', 'No'])).toBe(false)
  })
})

describe('yesNoOptionMatch', () => {
  it('matches a structural Yes/No set', () => {
    expect(yesNoOptionMatch(['Select an option', 'Yes', 'No'], true)).toBe('Yes')
    expect(yesNoOptionMatch(['Yes', 'No'], false)).toBe('No')
  })

  it('returns null for a non-Yes/No option set', () => {
    expect(yesNoOptionMatch(['Immediate', '30 days'], true)).toBeNull()
  })
})

describe('pickOptionByRule', () => {
  it('resolves a contains-any rule to the first matching candidate', () => {
    const rule = matchRule(buildRules(ANSWERS, ''), 'Which area of experience do you have?')
    expect(rule).toBeDefined()
    expect(pickOptionByRule(['Frontend', 'Machine Learning', 'Sales'], rule!)).toBe(
      'Machine Learning'
    )
  })
})
