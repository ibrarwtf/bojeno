import { describe, it, expect } from 'vitest'
import { buildLeverRules, matchLeverRule, pickDropdownAnswer } from './questionRules'
import type { AnswerBank } from '../../config/answerBank'

const answers: AnswerBank = {
  full_name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '+1 555 0100',
  resume_path: '/tmp/resume.pdf',
  current_ctc: 18,
  expected_ctc: 25,
  last_working_day: '2026-09-25',
  current_city: 'Hyderabad',
  current_area: '',
  current_state: '',
  current_country: '',
  postal_code: '',
  nationality: '',
  english_level: '',
  ethnicity: '',
  ethnicity_fallback: '',
  gender: '',
  disability: '',
  veteran: '',
  education_level: '',
  rsu: 0,
  technical_percent_floor: '80',
  technical_percent_default: '90',
  cover_letter_generic: 'I would love to join.',
  professional_summary: '',
  tools_platforms_answer: '',
  skills_summary: '',
  linkedin_profile_url: 'https://linkedin.com/in/janedoe',
  ai_adoption_answer: '',
  architecture_decision_answer: '',
  hybrid_days_onsite: '',
  llm_agent_experience: '',
  years_experience_default: '5',
  team_size_answer: '',
  current_company: 'Acme Corp'
}

describe('buildLeverRules / matchLeverRule', () => {
  const rules = buildLeverRules(answers)

  it('answers work-authorization honestly as No', () => {
    expect(matchLeverRule(rules, 'Are you authorized to work in the US?')).toBe('No')
  })

  it('answers sponsorship-required as Yes', () => {
    expect(matchLeverRule(rules, 'Will you now or in the future require sponsorship?')).toBe('Yes')
  })

  it('answers previous-employment as No', () => {
    expect(matchLeverRule(rules, 'Have you ever been previously employed by us?')).toBe('No')
  })

  it('fills current company from the answer bank', () => {
    expect(matchLeverRule(rules, 'What is your current employer?')).toBe('Acme Corp')
  })

  it('returns undefined for an unrecognized question', () => {
    expect(matchLeverRule(rules, 'Describe a time you disagreed with your manager')).toBeUndefined()
  })
})

describe('pickDropdownAnswer', () => {
  it('prefers an exact case-insensitive match', () => {
    expect(pickDropdownAnswer(['Yes', 'No'], 'no')).toBe('No')
  })

  it('falls back to a substring match', () => {
    expect(pickDropdownAnswer(['0-2 years', '3-5 years', '5+ years'], '5')).toBe('3-5 years')
  })

  it('returns null when nothing matches', () => {
    expect(pickDropdownAnswer(['Red', 'Blue'], 'Green')).toBeNull()
  })
})
