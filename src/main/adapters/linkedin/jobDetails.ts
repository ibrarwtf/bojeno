/**
 * Pure regex extraction over a job detail page's `main` innerText - no
 * selectors. Live-verified this session that LinkedIn's class names on this
 * page are not stable (the same job produced entirely different class names
 * between two loads in the same session); plain text anchors held up both
 * times. `afterq/tools/apply-easy-apply.mjs`'s captureJdInfo already solved
 * this the same way - yearsRequired/applicantCount below are ported from it
 * rather than re-derived.
 */
import type { FitTier } from '../../../shared/types'

/**
 * LinkedIn sometimes prints the poster's own stated requirement verbatim
 * ("Requirements added by the job poster: ... 4+ years of work experience
 * with Machine Learning") - a free, zero-LLM signal. Falls back to scanning
 * the whole JD for "N+ years" and taking the max mentioned, since not every
 * posting has the extracted-requirements line. Returns null if nothing
 * found - absence is never treated as a mismatch.
 */
export function parseYearsRequired(text: string): number | null {
  const posted = /requirements added by the job poster[^]{0,200}?(\d+)\+?\s*years?/i.exec(text)
  if (posted) return parseInt(posted[1], 10)
  const all = [...text.matchAll(/(\d+)\+\s*years?/gi)].map((m) => parseInt(m[1], 10))
  return all.length ? Math.max(...all) : null
}

/** "Over 100 applicants" / "47 applicants" - only on the detail page, not the list card. */
export function parseApplicantCount(text: string): string | null {
  const match = /\b((?:Over |Under )?\d+)\s+applicants?\b/i.exec(text)
  return match ? match[1] : null
}

/** The bare number out of parseApplicantCount's result ("Over 100" -> 100), for threshold comparisons. */
export function parseApplicantCountNumber(count: string | null): number | null {
  if (!count) return null
  const match = /(\d+)/.exec(count)
  return match ? parseInt(match[1], 10) : null
}

/** "11 hours ago" / "3 days ago" from the job's meta line. */
export function parsePostedRelative(text: string): string | null {
  const match = /(\d+)\s*(hour|day|week|minute)s?\s*ago/i.exec(text)
  return match ? match[0] : null
}

/** "15 people clicked apply" - a separate signal from applicantCount, seen on some postings instead of it. */
export function parseClickedApplyCount(text: string): string | null {
  const match = /([\d,]+)\s+people (?:clicked apply|applied)/i.exec(text)
  return match ? match[1] : null
}

/**
 * The separate "Applicants for this job" premium widget - two numbers, not
 * one ("352 Applicants" total, "299 Applicants in the past day"), distinct
 * from both parseApplicantCount's rough top-card figure and the "Candidates
 * who clicked apply" widget's own total/past-day pair (which use "total" /
 * "in the past day" as their labels instead of "Applicants"). Callers should
 * pass just this widget's section text (e.g. via extractBetween on the
 * "Applicants for this job" heading), not the whole page, since the rough
 * top-card figure would otherwise be matched first.
 */
export function parseApplicantInsightCounts(text: string): {
  total: number | null
  pastDay: number | null
} {
  const totalMatch = /(\d[\d,]*)\s*Applicants\b(?!\s+in the past day)/i.exec(text)
  const pastDayMatch = /(\d[\d,]*)\s*Applicants in the past day/i.exec(text)
  return {
    total: totalMatch ? parseInt(totalMatch[1].replace(/,/g, ''), 10) : null,
    pastDay: pastDayMatch ? parseInt(pastDayMatch[1].replace(/,/g, ''), 10) : null
  }
}

/**
 * The premium "fit" card's headline wording varies ("You'd be a top
 * applicant..." vs "Use AI to assess how you fit" - both seen on the same
 * job this session), so its exact text isn't a reliable anchor. The action
 * links next to it were stable across both, so presence is detected via
 * that cluster instead.
 */
export function hasFitSignal(text: string): boolean {
  return (
    text.includes('Tailor my resume') &&
    text.includes('Help me stand out') &&
    text.includes('Create cover letter')
  )
}

/**
 * The fit card's own tier wording - live-verified 2026-09-13 against real
 * postings, with at least two distinct sub-variants confirmed: the
 * pre-apply card ("...we can help you stand out" + Tailor my
 * resume/Help me stand out/Create cover letter) and a post-apply "Take the
 * next step" card ("...based on your skills, experience, and chances of
 * hearing back" + Practice an interview/Meet the hiring team) - the second
 * one confirmed live against a posting hasFitSignal's action-cluster check
 * wrongly returned false for, which had been silently downgrading a real
 * top-applicant match to null. Checking the headline wording directly,
 * before falling back to hasFitSignal's cluster check, means a new action
 * button set doesn't require a matching code change to not lose the tier.
 * Apostrophe matched loosely - LinkedIn uses a curly one.
 */
export function parseFitTier(text: string): FitTier | null {
  if (/you.?d be a top applicant/i.test(text)) return 'top'
  if (/job match is high/i.test(text)) return 'high'
  if (hasFitSignal(text)) return 'generic'
  return null
}

/**
 * Given the page's headings in document order, returns whichever comes
 * right after `marker` - LinkedIn always separates sections with a heading
 * (h2 for main sections, h3 for the applicant-insights subsection), so the
 * text of the next one is a boundary that holds regardless of what that
 * heading happens to say, rather than guessing a fixed marker string.
 */
export function nextHeadingAfter(headings: string[], marker: string): string | null {
  const index = headings.indexOf(marker)
  if (index === -1 || index === headings.length - 1) return null
  return headings[index + 1]
}

/**
 * Slices from a start marker up to whichever stop marker occurs first after
 * it (or to the end of the text if none do). Live-verified this was needed:
 * a plain start-to-end-of-text slice for "About the job" and "Candidates
 * who clicked apply" ran straight through into the page's "More jobs"
 * recommendation rail, the footer, and the language picker - there's no
 * single stable end-of-section marker. Callers should pass the actual next
 * heading (via nextHeadingAfter) first, with a small fixed list as a
 * fallback only for when the heading structure itself is missing.
 */
/**
 * Ported from afterq/tools/find-hiring-posts.mjs's EMAIL_RE/JUNK approach -
 * a plain email regex plus a junk filter for addresses that are obviously
 * not a human application inbox (LinkedIn's own asset/tracking domains,
 * placeholder addresses). Dedupes and lowercases nothing - callers get back
 * exactly what was printed on the page.
 */
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const EMAIL_JUNK_RE = /(example|sentry|linkedin\.com|licdn|\.png|\.jpg|@2x|noreply|no-reply)/i

export function extractEmails(text: string): string[] {
  const found = text.match(EMAIL_RE) ?? []
  const seen = new Set<string>()
  const out: string[] = []
  for (const email of found) {
    if (EMAIL_JUNK_RE.test(email)) continue
    const key = email.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(email)
  }
  return out
}

/**
 * Conservative international-friendly phone matcher - false negatives are
 * fine (this is a bonus signal, not the primary path), but it must not
 * match years, applicant counts, or other bare short numbers scattered
 * through a JD. Requires either a leading `+<country code>` (e.g.
 * "+91 8591450377", "+918591450377") or a parenthesized US-style area code
 * ("(415) 555-0100"), each followed by enough digits (7-13, allowing
 * spaces/dashes/dots as separators) that a bare "4+ years" or "352
 * Applicants" can never qualify.
 */
const PHONE_RE = /(?:\+\d{1,3}[\s.-]?(?:\d[\s.-]?){7,12}\d|\(\d{3}\)[\s.-]?\d{3}[\s.-]?\d{4})/g

export function extractPhones(text: string): string[] {
  const found = text.match(PHONE_RE) ?? []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of found) {
    const phone = raw.trim()
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 8 || digits.length > 15) continue
    if (seen.has(phone)) continue
    seen.add(phone)
    out.push(phone)
  }
  return out
}

export function extractBetween(
  text: string,
  startMarker: string,
  stopMarkers: string[]
): string | null {
  const start = text.indexOf(startMarker)
  if (start === -1) return null

  const stopIndexes = stopMarkers
    .map((marker) => text.indexOf(marker, start + startMarker.length))
    .filter((index) => index !== -1)
  const end = stopIndexes.length ? Math.min(...stopIndexes) : text.length

  return text.slice(start, end).trim()
}
