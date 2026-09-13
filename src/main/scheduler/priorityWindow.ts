/**
 * Priority-window config for the scheduler (see bojeno-project-brief.md §4).
 * Deliberately a small, explicit structure - a couple of peak windows plus
 * two intervals - not a general-purpose cron/rule engine. Hardcoded; no
 * settings UI. Hours are local wall-clock hours (0-23), start inclusive, end
 * exclusive, e.g. `{ startHour: 9, endHour: 11 }` covers 9:00-10:59.
 */
export interface PriorityWindow {
  startHour: number
  endHour: number
}

export interface PriorityScheduleConfig {
  peakWindows: PriorityWindow[]
  /** How often (minutes) to check during a peak window. */
  peakIntervalMinutes: number
  /** How often (minutes) to check outside every peak window. */
  offPeakIntervalMinutes: number
}

/** Fresh postings and early-applicant advantage matter most mid-morning and
 *  mid-afternoon - see brief §4. Off-peak checks less often; peak roughly
 *  hourly. */
export const DEFAULT_SCHEDULE_CONFIG: PriorityScheduleConfig = {
  peakWindows: [
    { startHour: 9, endHour: 11 },
    { startHour: 14, endHour: 17 }
  ],
  peakIntervalMinutes: 60,
  offPeakIntervalMinutes: 180
}

export function isPeakWindow(
  date: Date,
  config: PriorityScheduleConfig = DEFAULT_SCHEDULE_CONFIG
): boolean {
  const hour = date.getHours()
  return config.peakWindows.some((window) => hour >= window.startHour && hour < window.endHour)
}

/** The check interval, in minutes, that applies at `date`. */
export function intervalForTime(
  date: Date,
  config: PriorityScheduleConfig = DEFAULT_SCHEDULE_CONFIG
): number {
  return isPeakWindow(date, config) ? config.peakIntervalMinutes : config.offPeakIntervalMinutes
}

/** Whether enough time has passed since `lastRunAt` (null = never run) for
 *  another scheduled check to be due at `now`, per the interval in effect
 *  at `now`. */
export function isDue(
  now: Date,
  lastRunAt: Date | null,
  config: PriorityScheduleConfig = DEFAULT_SCHEDULE_CONFIG
): boolean {
  if (!lastRunAt) return true
  const intervalMs = intervalForTime(now, config) * 60_000
  return now.getTime() - lastRunAt.getTime() >= intervalMs
}
