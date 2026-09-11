import { describe, it, expect } from 'vitest'
import { parseAppliedRelativeText, isWithinPast24Hours } from './relativeTime'

const now = new Date('2026-09-11T12:00:00.000Z')

describe('parseAppliedRelativeText', () => {
  it('parses hours', () => {
    const result = parseAppliedRelativeText('Applied 15h ago', now)
    expect(result?.toISOString()).toBe('2026-09-10T21:00:00.000Z')
  })

  it('parses days', () => {
    const result = parseAppliedRelativeText('Applied 2d ago', now)
    expect(result?.toISOString()).toBe('2026-09-09T12:00:00.000Z')
  })

  it('parses minutes', () => {
    const result = parseAppliedRelativeText('Applied 45m ago', now)
    expect(result?.toISOString()).toBe('2026-09-11T11:15:00.000Z')
  })

  it('parses weeks', () => {
    const result = parseAppliedRelativeText('Applied 1w ago', now)
    expect(result?.toISOString()).toBe('2026-09-04T12:00:00.000Z')
  })

  it('returns null for unrecognized text', () => {
    expect(parseAppliedRelativeText('Applied yesterday', now)).toBeNull()
  })
})

describe('isWithinPast24Hours', () => {
  it('is true for 23 hours ago', () => {
    const appliedAt = new Date(now.getTime() - 23 * 60 * 60_000)
    expect(isWithinPast24Hours(appliedAt, now)).toBe(true)
  })

  it('is true for exactly 24 hours ago', () => {
    const appliedAt = new Date(now.getTime() - 24 * 60 * 60_000)
    expect(isWithinPast24Hours(appliedAt, now)).toBe(true)
  })

  it('is false for 25 hours ago', () => {
    const appliedAt = new Date(now.getTime() - 25 * 60 * 60_000)
    expect(isWithinPast24Hours(appliedAt, now)).toBe(false)
  })
})
