import { describe, it, expect } from 'vitest'
import {
  parseYearsRequired,
  parseApplicantCount,
  parseApplicantCountNumber,
  parseApplicantInsightCounts,
  parsePostedRelative,
  parseClickedApplyCount,
  hasFitSignal,
  parseFitTier,
  extractBetween,
  nextHeadingAfter,
  extractEmails,
  extractPhones
} from './jobDetails'

// Trimmed from a real job page's `main.innerText`, captured live this session.
const FIXTURE = `Quik Hire Staffing

Data Engineer (Machine Learning) (Remote)

India · 11 hours ago · 15 people clicked apply

Promoted by hirer · Responses managed off LinkedIn

Remote
Part-time
Apply
Save
Use AI to assess how you fit

Show match details

Tailor my resume

Create cover letter

Help me stand out

People you can reach out to

About the job

Role: Data Engineer (Machine Learning) (Remote)
Requires 4+ years of experience with Python.

Candidates who clicked apply

15

total

15

in the past day

Candidate seniority level

87% Entry level candidates`

describe('parsePostedRelative', () => {
  it('extracts the relative posted time', () => {
    expect(parsePostedRelative(FIXTURE)).toBe('11 hours ago')
  })

  it('returns null when absent', () => {
    expect(parsePostedRelative('no timing info here')).toBeNull()
  })
})

describe('parseClickedApplyCount', () => {
  it('extracts the clicked-apply count', () => {
    expect(parseClickedApplyCount(FIXTURE)).toBe('15')
  })

  it('returns null when absent', () => {
    expect(parseClickedApplyCount('nothing to see here')).toBeNull()
  })
})

describe('parseApplicantCount', () => {
  it('extracts a plain applicant count', () => {
    expect(parseApplicantCount('47 applicants')).toBe('47')
  })

  it('extracts an "Over N" applicant count', () => {
    expect(parseApplicantCount('Over 100 applicants')).toBe('Over 100')
  })

  it('returns null when the fixture uses "clicked apply" phrasing instead', () => {
    expect(parseApplicantCount(FIXTURE)).toBeNull()
  })
})

describe('parseApplicantCountNumber', () => {
  it('extracts the bare number from a plain count', () => {
    expect(parseApplicantCountNumber('47')).toBe(47)
  })

  it('extracts the bare number from an "Over N" count', () => {
    expect(parseApplicantCountNumber('Over 100')).toBe(100)
  })

  it('returns null when given null', () => {
    expect(parseApplicantCountNumber(null)).toBeNull()
  })
})

describe('parseApplicantInsightCounts', () => {
  const SECTION =
    'Applicants for this job\n\n352\n\nApplicants\n\n299\n\nApplicants in the past day'

  it('extracts both the total and past-day counts', () => {
    expect(parseApplicantInsightCounts(SECTION)).toEqual({ total: 352, pastDay: 299 })
  })

  it('strips thousands separators', () => {
    const text = '1,352 Applicants\n1,299 Applicants in the past day'
    expect(parseApplicantInsightCounts(text)).toEqual({ total: 1352, pastDay: 1299 })
  })

  it('returns nulls when the section is absent', () => {
    expect(parseApplicantInsightCounts('no premium widget on this posting')).toEqual({
      total: null,
      pastDay: null
    })
  })
})

describe('parseYearsRequired', () => {
  it('takes the max of any "N+ years" mentions', () => {
    expect(parseYearsRequired(FIXTURE)).toBe(4)
  })

  it('prefers the poster-stated requirement line when present', () => {
    const text =
      'Requirements added by the job poster: * 8+ years of work experience. Elsewhere: 2+ years.'
    expect(parseYearsRequired(text)).toBe(8)
  })

  it('returns null when no years are mentioned', () => {
    expect(parseYearsRequired('no experience requirement stated')).toBeNull()
  })
})

describe('hasFitSignal', () => {
  it('detects the fit-card action cluster regardless of headline wording', () => {
    expect(hasFitSignal(FIXTURE)).toBe(true)
  })

  it('returns false when the cluster is absent', () => {
    expect(hasFitSignal('no premium card on this posting')).toBe(false)
  })
})

describe('parseFitTier', () => {
  // Both headline variants below are live-verified against real postings
  // (2026-09-13) - see jobDetails.ts's parseFitTier docstring.
  const CLUSTER = 'Tailor my resume\nHelp me stand out\nCreate cover letter'

  it("returns 'top' for LinkedIn's top-applicant wording", () => {
    expect(parseFitTier(`You'd be a top applicant, we can help you stand out\n${CLUSTER}`)).toBe(
      'top'
    )
  })

  it('matches the top-applicant wording with a curly apostrophe too', () => {
    expect(parseFitTier(`You’d be a top applicant, we can help you stand out\n${CLUSTER}`)).toBe(
      'top'
    )
  })

  it("returns 'high' for LinkedIn's high-match wording", () => {
    expect(parseFitTier(`Job match is high, we can help you stand out\n${CLUSTER}`)).toBe('high')
  })

  it("returns 'generic' when the fit card is present with other wording", () => {
    expect(parseFitTier(FIXTURE)).toBe('generic')
  })

  it('returns null when the fit card is absent entirely', () => {
    expect(parseFitTier('no premium card on this posting')).toBeNull()
  })

  it("returns 'top' for the post-apply 'Take the next step' card variant, which has no Tailor my resume/Help me stand out/Create cover letter cluster", () => {
    // Confirmed live 2026-09-13 against a real posting: hasFitSignal's
    // cluster check returned false for this variant (different action
    // buttons - Practice an interview/Meet the hiring team), which had been
    // silently downgrading a real top-applicant match to null.
    const text =
      "Take the next step in your job search\n\nYou'd be a top applicant, based on your skills, experience, and chances of hearing back\n\nPractice an interview\n\nMeet the hiring team"
    expect(parseFitTier(text)).toBe('top')
    expect(hasFitSignal(text)).toBe(false)
  })
})

describe('nextHeadingAfter', () => {
  const HEADINGS = ['Use AI to assess how you fit', 'About the job', 'Set alert for similar jobs']

  it('returns the heading right after the marker', () => {
    expect(nextHeadingAfter(HEADINGS, 'About the job')).toBe('Set alert for similar jobs')
  })

  it('returns null when the marker is the last heading', () => {
    expect(nextHeadingAfter(HEADINGS, 'Set alert for similar jobs')).toBeNull()
  })

  it('returns null when the marker is absent', () => {
    expect(nextHeadingAfter(HEADINGS, 'not a real heading')).toBeNull()
  })
})

describe('extractEmails', () => {
  it('extracts a plain hiring inbox address', () => {
    expect(extractEmails('Send the following to hiring@vanexson.com')).toEqual([
      'hiring@vanexson.com'
    ])
  })

  it('extracts multiple addresses, deduped and case-insensitively', () => {
    const text = 'Email HR@Company.com or reach out to hr@company.com or jobs@company.io'
    expect(extractEmails(text)).toEqual(['HR@Company.com', 'jobs@company.io'])
  })

  it('filters out LinkedIn/asset/placeholder junk addresses', () => {
    const text = 'noreply@licdn.com and support@example.com and real@company.com'
    expect(extractEmails(text)).toEqual(['real@company.com'])
  })

  it('returns an empty array when no email is present', () => {
    expect(extractEmails(FIXTURE)).toEqual([])
  })
})

describe('extractPhones', () => {
  it('extracts an international number with a space after the country code', () => {
    expect(extractPhones('Contact us at +91 8591450377 for details')).toEqual(['+91 8591450377'])
  })

  it('extracts an international number with no separators', () => {
    expect(extractPhones('Phone +918591450377')).toEqual(['+918591450377'])
  })

  it('extracts a US-style parenthesized number', () => {
    expect(extractPhones('Call (415) 555-0100 anytime')).toEqual(['(415) 555-0100'])
  })

  it('does not match a "N+ years" requirement', () => {
    expect(extractPhones('Requires 4+ years of experience')).toEqual([])
  })

  it('does not match an applicant count', () => {
    expect(extractPhones('352 Applicants for this job')).toEqual([])
  })

  it('does not match a bare short number with no country code or area-code format', () => {
    expect(extractPhones('Reference number 8591450377')).toEqual([])
  })

  it('returns an empty array when no phone is present', () => {
    expect(extractPhones(FIXTURE)).toEqual([])
  })
})

describe('extractBetween', () => {
  it('slices from the start marker to the end when no stop marker is present', () => {
    expect(extractBetween(FIXTURE, 'Candidates who clicked apply', ['More jobs'])).toBe(
      'Candidates who clicked apply\n\n15\n\ntotal\n\n15\n\nin the past day\n\nCandidate seniority level\n\n87% Entry level candidates'
    )
  })

  it('stops at the first matching stop marker after the start', () => {
    const text = 'About the job\n\nSome JD text.\n\nMore jobs\n\nUnrelated recommendation rail.'
    expect(extractBetween(text, 'About the job', ['More jobs', 'See more jobs like this'])).toBe(
      'About the job\n\nSome JD text.'
    )
  })

  it('returns null when the start marker is absent', () => {
    expect(extractBetween(FIXTURE, 'not present anywhere', ['More jobs'])).toBeNull()
  })
})
