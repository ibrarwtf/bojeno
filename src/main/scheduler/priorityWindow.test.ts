import { describe, it, expect } from 'vitest'
import {
  DEFAULT_SCHEDULE_CONFIG,
  isPeakWindow,
  intervalForTime,
  isDue,
  type PriorityScheduleConfig
} from './priorityWindow'

const config: PriorityScheduleConfig = DEFAULT_SCHEDULE_CONFIG

function at(hour: number, minute = 0): Date {
  const d = new Date(2026, 8, 12, hour, minute, 0, 0)
  return d
}

describe('isPeakWindow', () => {
  it('is true at the start of a peak window', () => {
    expect(isPeakWindow(at(9, 0), config)).toBe(true)
  })

  it('is true in the middle of a peak window', () => {
    expect(isPeakWindow(at(15, 30), config)).toBe(true)
  })

  it('is false exactly at a peak window end (end exclusive)', () => {
    expect(isPeakWindow(at(11, 0), config)).toBe(false)
  })

  it('is false outside any peak window', () => {
    expect(isPeakWindow(at(3, 0), config)).toBe(false)
    expect(isPeakWindow(at(12, 30), config)).toBe(false)
    expect(isPeakWindow(at(22, 0), config)).toBe(false)
  })
})

describe('intervalForTime', () => {
  it('returns the peak interval during a peak window', () => {
    expect(intervalForTime(at(10, 0), config)).toBe(config.peakIntervalMinutes)
  })

  it('returns the off-peak interval outside peak windows', () => {
    expect(intervalForTime(at(20, 0), config)).toBe(config.offPeakIntervalMinutes)
  })
})

describe('isDue', () => {
  it('is due when never run before', () => {
    expect(isDue(at(10, 0), null, config)).toBe(true)
  })

  it('is not due before the peak interval has elapsed', () => {
    const lastRun = at(10, 0)
    const now = at(10, 30)
    expect(isDue(now, lastRun, config)).toBe(false)
  })

  it('is due once the peak interval has elapsed', () => {
    const lastRun = at(9, 0)
    const now = at(10, 1) // 61 min later, still inside the same peak window
    expect(isDue(now, lastRun, config)).toBe(true)
  })

  it('is not due before the off-peak interval has elapsed', () => {
    const lastRun = at(20, 0)
    const now = at(21, 0) // 60 min later, but off-peak interval is 180
    expect(isDue(now, lastRun, config)).toBe(false)
  })

  it('is due once the off-peak interval has elapsed', () => {
    const lastRun = at(20, 0)
    const now = at(23, 1)
    expect(isDue(now, lastRun, config)).toBe(true)
  })
})
