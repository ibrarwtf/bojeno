import { describe, it, expect } from 'vitest'
import { compileKeyword, buildTitleFilter } from './titleFilter'

describe('compileKeyword', () => {
  it('anchors a short 2-3 letter keyword on word boundaries', () => {
    const match = compileKeyword('ai')
    expect(match('senior ai engineer')).toBe(true)
    expect(match('domain expert')).toBe(false)
    expect(match('again and again')).toBe(false)
  })

  it('matches longer keywords as a plain substring', () => {
    const match = compileKeyword('.net')
    expect(match('.net developer')).toBe(true)
    expect(match('dotnet developer')).toBe(false)
  })
})

describe('buildTitleFilter', () => {
  it('passes every title when no config is given', () => {
    const filter = buildTitleFilter(undefined)
    expect(filter('.NET Developer Team Lead')).toBe(true)
  })

  it('rejects a title with no positive-keyword hit once positive is set', () => {
    const filter = buildTitleFilter({ positive: ['ai', 'machine learning', 'llm'] })
    expect(filter('AI Engineer (Azure)')).toBe(true)
    expect(filter('.NET Developer Team Lead')).toBe(false)
    expect(filter('Mobile Application Development Trainer')).toBe(false)
  })

  it('rejects a title with a negative-keyword hit even if positive matches', () => {
    const filter = buildTitleFilter({ positive: ['engineer'], negative: ['.net'] })
    expect(filter('.NET Engineer')).toBe(false)
  })
})
