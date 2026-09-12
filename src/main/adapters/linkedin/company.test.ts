import { describe, it, expect } from 'vitest'
import { parseCompanyAboutText, extractCompanyIdFromHtml, toCompanyAboutUrl } from './company'

// Trimmed from linkedin.com/company/zetheta/about/'s real main.innerText,
// captured live this session.
const FIXTURE = `Technology, Information and Internet Mumbai 564K followers 51-200 employees

Overview

Zetheta Algorithms builds AI-driven trading and investment tools.

Website

www.zetheta.com

Phone

+918591450377

Industry

Technology, Information and Internet

Company size

51-200 employees

374 associated members

Founded

2024

Specialties

Internship, Artificial Intelligence, Investment Management,`

describe('parseCompanyAboutText', () => {
  it('extracts every labeled field from the real fixture', () => {
    expect(parseCompanyAboutText(FIXTURE)).toEqual({
      website: 'www.zetheta.com',
      industry: 'Technology, Information and Internet',
      companySize: '51-200 employees',
      founded: '2024',
      specialties: 'Internship, Artificial Intelligence, Investment Management',
      overview: 'Zetheta Algorithms builds AI-driven trading and investment tools.'
    })
  })

  it('returns nulls for every field when the text has none of the known labels', () => {
    expect(parseCompanyAboutText('Just some unrelated page text.')).toEqual({
      website: null,
      industry: null,
      companySize: null,
      founded: null,
      specialties: null,
      overview: null
    })
  })

  it('stops the overview at the first known label even with no blank lines between', () => {
    const text = 'Overview\nA short overview sentence.\nWebsite\nwww.acme.com'
    expect(parseCompanyAboutText(text).overview).toBe('A short overview sentence.')
    expect(parseCompanyAboutText(text).website).toBe('www.acme.com')
  })

  it('does not confuse "374 associated members" with the company size value', () => {
    expect(parseCompanyAboutText(FIXTURE).companySize).toBe('51-200 employees')
  })
})

describe('extractCompanyIdFromHtml', () => {
  it('extracts the id from a currentCompany filter link', () => {
    const html = '<a href="/search/results/people/?currentCompany=%5B%2212345%22%5D">Employees</a>'
    expect(extractCompanyIdFromHtml(html)).toBe('12345')
  })

  it('extracts the id from a company urn when no filter link is present', () => {
    const html = '<script>{"entityUrn":"urn:li:fsd_company:98765"}</script>'
    expect(extractCompanyIdFromHtml(html)).toBe('98765')
  })

  it('prefers whichever id occurs most often across multiple shapes', () => {
    const html = `
      <a href="?currentCompany=%5B%2211111%22%5D">a</a>
      <a href="?currentCompany=%5B%2211111%22%5D">b</a>
      <span>urn:li:company:22222</span>
    `
    expect(extractCompanyIdFromHtml(html)).toBe('11111')
  })

  it('returns null when no id pattern is found', () => {
    expect(extractCompanyIdFromHtml('<html><body>nothing here</body></html>')).toBeNull()
  })
})

describe('toCompanyAboutUrl', () => {
  it('appends /about/ to a bare company url', () => {
    expect(toCompanyAboutUrl('https://www.linkedin.com/company/zetheta')).toBe(
      'https://www.linkedin.com/company/zetheta/about/'
    )
  })

  it('normalizes a url that already ends with a trailing slash', () => {
    expect(toCompanyAboutUrl('https://www.linkedin.com/company/zetheta/')).toBe(
      'https://www.linkedin.com/company/zetheta/about/'
    )
  })

  it('is idempotent on a url that already points at /about', () => {
    expect(toCompanyAboutUrl('https://www.linkedin.com/company/zetheta/about/')).toBe(
      'https://www.linkedin.com/company/zetheta/about/'
    )
  })
})
