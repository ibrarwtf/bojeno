import { describe, it, expect } from 'vitest'
import { leverPostingsUrl, mapLeverPosting } from './adapter'

describe('leverPostingsUrl', () => {
  it('builds the v0 postings URL for a slug', () => {
    expect(leverPostingsUrl('coalfire')).toBe('https://api.lever.co/v0/postings/coalfire')
  })

  it('URL-encodes the slug', () => {
    expect(leverPostingsUrl('a b/c')).toBe('https://api.lever.co/v0/postings/a%20b%2Fc')
  })

  it('supports the EU mirror host', () => {
    expect(leverPostingsUrl('acme', 'api.eu.lever.co')).toBe(
      'https://api.eu.lever.co/v0/postings/acme'
    )
  })
})

describe('mapLeverPosting', () => {
  it('maps a full raw posting to the normalized shape', () => {
    const result = mapLeverPosting('Acme', {
      text: 'Senior Engineer',
      hostedUrl: 'https://jobs.lever.co/acme/abc-123',
      categories: { location: 'Remote' },
      descriptionPlain: 'Build things.',
      createdAt: 1_700_000_000_000
    })

    expect(result).toEqual({
      source: 'lever',
      externalId: 'https://jobs.lever.co/acme/abc-123',
      title: 'Senior Engineer',
      company: 'Acme',
      location: 'Remote',
      url: 'https://jobs.lever.co/acme/abc-123',
      description: 'Build things.',
      postedAt: new Date(1_700_000_000_000).toISOString()
    })
  })

  it('falls back to empty/null fields when the raw posting is missing them', () => {
    const result = mapLeverPosting('Acme', {})

    expect(result).toEqual({
      source: 'lever',
      externalId: '',
      title: '',
      company: 'Acme',
      location: '',
      url: '',
      description: '',
      postedAt: null
    })
  })
})
