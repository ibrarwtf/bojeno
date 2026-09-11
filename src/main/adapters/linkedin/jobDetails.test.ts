import { describe, it, expect } from 'vitest'
import {
  parseYearsRequired,
  parseApplicantCount,
  parsePostedRelative,
  parseClickedApplyCount,
  hasFitSignal,
  extractBetween,
  nextHeadingAfter
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
