import { describe, it, expect } from 'vitest'
import { extractTitleFromPaneLines } from './searchPaneApply'

describe('extractTitleFromPaneLines', () => {
  it('skips the pane action buttons between company and title', () => {
    const text = [
      'Quik Hire Staffing',
      'Share',
      'Show more options',
      'Backend Software Engineer (Remote)',
      'United Arab Emirates · 4 hours ago · 88 applicants'
    ].join('\n')
    expect(extractTitleFromPaneLines(text, 'Quik Hire Staffing')).toBe(
      'Backend Software Engineer (Remote)'
    )
  })

  it('falls back to the first line when the company text is absent from the lines', () => {
    const text = ['Software Engineer', 'Somewhere Inc', 'About the job'].join('\n')
    expect(extractTitleFromPaneLines(text, '')).toBe('Software Engineer')
  })

  it('returns the first non-noise line when there is no gap at all', () => {
    const text = ['Acme Corp', 'Staff Engineer', 'About the job'].join('\n')
    expect(extractTitleFromPaneLines(text, 'Acme Corp')).toBe('Staff Engineer')
  })
})
