const UNIT_MS: Record<string, number> = {
  m: 60_000,
  h: 60 * 60_000,
  d: 24 * 60 * 60_000,
  w: 7 * 24 * 60 * 60_000
}

/**
 * Parses LinkedIn's "Applied Xh ago" / "Applied Xd ago" style relative
 * text into an absolute timestamp, relative to `now`. Approximate — the
 * source text itself is already rounded to a whole unit — but good enough
 * to decide whether a job falls within the past 24h.
 */
export function parseAppliedRelativeText(text: string, now: Date): Date | null {
  const match = text.match(/(\d+)\s*(m|h|d|w)\b/i)
  if (!match) return null
  const amount = Number(match[1])
  const unit = match[2].toLowerCase()
  const unitMs = UNIT_MS[unit]
  if (!unitMs) return null
  return new Date(now.getTime() - amount * unitMs)
}

export function isWithinPast24Hours(appliedAt: Date, now: Date): boolean {
  return now.getTime() - appliedAt.getTime() <= 24 * 60 * 60_000
}
