import { describe, it, expect } from 'vitest'
import { parseCardFromLeaves, buildSearchUrl } from './scan'

describe('parseCardFromLeaves', () => {
  it('parses a plain card with title, company, location', () => {
    const leaves = ['Data Engineer', 'Quik Hire Staffing', 'India', 'Easy Apply', '2 days ago']
    const card = parseCardFromLeaves('123', leaves)
    expect(card).toEqual({
      id: '123',
      title: 'Data Engineer',
      company: 'Quik Hire Staffing',
      location: 'India',
      easyApply: true,
      alreadyApplied: false,
      postedRelative: '2 days ago',
      parseWarning: false
    })
  })

  it('collapses the accessible-name duplicate title leaf', () => {
    const leaves = [
      'Data Engineer',
      'Data Engineer with verification',
      'Quik Hire Staffing',
      'India'
    ]
    const card = parseCardFromLeaves('123', leaves)
    expect(card.title).toBe('Data Engineer')
    expect(card.company).toBe('Quik Hire Staffing')
    expect(card.location).toBe('India')
  })

  it('detects "Applied" status', () => {
    const leaves = ['Data Engineer', 'Quik Hire Staffing', 'India', 'Applied']
    expect(parseCardFromLeaves('123', leaves).alreadyApplied).toBe(true)
  })

  it('falls back to a freshness bucket when no "ago" leaf is present', () => {
    const leaves = ['Data Engineer', 'Quik Hire Staffing', 'India', 'Within the past 24 hours']
    expect(parseCardFromLeaves('123', leaves).postedRelative).toBe('Within the past 24 hours')
  })

  it('returns null postedRelative when neither is present', () => {
    const leaves = ['Data Engineer', 'Quik Hire Staffing', 'India']
    expect(parseCardFromLeaves('123', leaves).postedRelative).toBeNull()
  })

  it('flags parseWarning when a required field is missing', () => {
    const leaves = ['Data Engineer']
    expect(parseCardFromLeaves('123', leaves).parseWarning).toBe(true)
  })

  it('flags parseWarning when a badge lands in the company/location position', () => {
    const leaves = ['Data Engineer', 'Premium', 'India']
    expect(parseCardFromLeaves('123', leaves).parseWarning).toBe(true)
  })
})

describe('buildSearchUrl', () => {
  it('builds a classic-mode URL with keywords and location', () => {
    const url = buildSearchUrl({ keywords: 'data engineer', location: 'India' })
    const parsed = new URL(url)
    expect(parsed.pathname).toBe('/jobs/search/')
    expect(parsed.searchParams.get('keywords')).toBe('data engineer')
    expect(parsed.searchParams.get('location')).toBe('India')
    expect(parsed.searchParams.get('origin')).toBe('CLASSIC_SEARCH_MODE_FROM_SEMANTIC')
  })

  it('omits keywords/location params when not given', () => {
    const url = buildSearchUrl({})
    const parsed = new URL(url)
    expect(parsed.searchParams.has('keywords')).toBe(false)
    expect(parsed.searchParams.has('location')).toBe(false)
    expect(parsed.searchParams.get('origin')).toBe('CLASSIC_SEARCH_MODE_FROM_SEMANTIC')
  })

  it('sets sortBy=DD ("Most recent") when sortByRecent is true', () => {
    const url = buildSearchUrl({ sortByRecent: true })
    expect(new URL(url).searchParams.get('sortBy')).toBe('DD')
  })

  it('omits sortBy when sortByRecent is not given', () => {
    const url = buildSearchUrl({})
    expect(new URL(url).searchParams.has('sortBy')).toBe(false)
  })

  it('sets f_AL=true when easyApplyOnly is true', () => {
    const url = buildSearchUrl({ easyApplyOnly: true })
    expect(new URL(url).searchParams.get('f_AL')).toBe('true')
  })

  it('omits f_AL when easyApplyOnly is not given', () => {
    const url = buildSearchUrl({})
    expect(new URL(url).searchParams.has('f_AL')).toBe(false)
  })
})
