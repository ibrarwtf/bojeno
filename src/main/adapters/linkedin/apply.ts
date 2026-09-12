/**
 * Ported from afterq/tools/apply-easy-apply.mjs's answerVisibleFields/
 * discardModal/attemptApply. Mechanical DOM interaction only - matches
 * questions to rules built by applyRules.ts from a caller-supplied
 * AnswerBank. Batching, eligibility screening, and apply-order sorting
 * (the legacy script's queue-processing loop) are deliberately not ported
 * yet - this proves the single-job apply mechanic first; a scan+apply
 * orchestration step can wire the queue later.
 */
import type { Locator, Page } from 'playwright-core'
import type { ApplyResult } from '../../../shared/types'
import {
  matchRule,
  pickOptionByRule,
  looksLikeNoticeOptions,
  pickNoticeOption,
  yesNoOptionMatch,
  buildRules
} from './applyRules'
import type { Rule } from './applyRules'
import { loadAnswerBank } from '../../config/answerBank'

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
const pace = (min = 500, max = 1500): Promise<void> =>
  sleep(Math.floor(Math.random() * (max - min) + min))

export function buildApplyUrl(jobId: string): string {
  return `https://www.linkedin.com/jobs/view/${jobId}/apply/?openSDUIApplyFlow=true`
}

function cssEscapeId(id: string): string {
  return id.replace(/([^\w-])/g, '\\$1')
}

/** A throwaway value that satisfies most text/number field validation -
 *  never submitted, since any unmatched question stops this pass short of
 *  the real Submit click. Only used to keep the modal walkable so later
 *  questions on this step/later steps still get discovered and captured. */
const PLACEHOLDER_TEXT_VALUE = '1'

interface UnmatchedQuestion {
  kind: 'text' | 'select' | 'radio'
  label: string
}

interface FillResult {
  /** True the moment a photo/file upload blocks the whole step - nothing
   *  else on the step is inspected, since there's no way to proceed at all. */
  blocked: boolean
  reason?: string
  /** Every field on this step that had no real answer - filled with
   *  PLACEHOLDER_TEXT_VALUE (or an arbitrary option) instead of stopping,
   *  so the walk can keep discovering later questions on this step and
   *  beyond. Empty when every field was genuinely answered. */
  unmatchedQuestions: UnmatchedQuestion[]
}

/**
 * Answers every recognizable field on the current modal step, in "capture
 * mode": a field with no real answer is never a hard stop - it's filled
 * with a throwaway placeholder (so the step can still be left, and later
 * questions on this step or subsequent ones are still discovered) and
 * recorded in `unmatchedQuestions` for review. The one true hard stop is a
 * required file/photo upload, which isn't automatable at all.
 */
export async function answerVisibleFields(modal: Locator, rules: Rule[]): Promise<FillResult> {
  // Photo/file-upload requirements aren't automatable at all. Not scoped
  // to [required] - some third-party ATS forms don't mark it in markup
  // even though the step won't advance without it. But every Easy Apply
  // flow's own Resume step also has input[type=file] and must NOT be
  // flagged - distinguish by whether a filename is actually showing.
  const fileInputs = await modal.locator('input[type="file"]:visible').count()
  if (fileInputs) {
    const stepText = await modal.innerText().catch(() => '')
    if (!/\.(pdf|docx?|jpe?g|png|gif)\b/i.test(stepText)) {
      return {
        blocked: true,
        reason: 'requires a file/photo upload - not automatable',
        unmatchedQuestions: []
      }
    }
  }

  const unmatchedQuestions: UnmatchedQuestion[] = []

  const textInputs = await modal.locator('input[type="text"], input[type="number"], textarea').all()
  for (const inp of textInputs) {
    const existing = await inp.inputValue().catch(() => '')
    if (existing) continue // already prefilled by LinkedIn (contact info etc.)
    const id = await inp.getAttribute('id')
    let label = ''
    if (id) {
      const lbl = modal.locator(`label[for="${cssEscapeId(id)}"]`)
      if (await lbl.count()) label = ((await lbl.textContent()) ?? '').trim()
    }
    if (!label) label = ((await inp.getAttribute('aria-label')) ?? '').trim()
    if (!label) continue

    const rule = matchRule(rules, label)
    // A matched rule with a blank answer-bank value (e.g. llm_agent_experience
    // left empty) is just as much "no real answer" as no rule at all - both
    // fall back to the placeholder and both get flagged below.
    const hasRealAnswer = Boolean(rule?.value)

    // Typeahead fields (e.g. "Location (city)") are role=combobox.
    const isTypeahead = (await inp.getAttribute('role').catch(() => null)) === 'combobox'

    await pace()
    await inp.fill(rule?.value || PLACEHOLDER_TEXT_VALUE)

    if (isTypeahead) {
      // Opens a suggestion dropdown that sits on top of the Next/Review
      // button and blocks the click - pick the matching suggestion.
      // Deliberately NOT pressing Escape: it bubbles to the dialog and
      // triggers its own close/discard-confirm.
      await sleep(600)
      const suggestion = modal
        .locator('[data-test-single-typeahead-entity-form-search-result]')
        .first()
      if (await suggestion.count().catch(() => 0)) {
        await pace()
        await suggestion.click().catch(() => {})
      }
    }

    const after = await inp.inputValue().catch(() => '')
    if (!hasRealAnswer || !after) unmatchedQuestions.push({ kind: 'text', label })
  }

  const selects = await modal.locator('select').all()
  for (const sel of selects) {
    const current = await sel.inputValue().catch(() => '')
    const id = await sel.getAttribute('id')
    let label = ''
    if (id) {
      const lbl = modal.locator(`label[for="${cssEscapeId(id)}"]`)
      if (await lbl.count()) label = ((await lbl.textContent()) ?? '').trim()
    }
    if (!label) label = ((await sel.getAttribute('aria-label')) ?? '').trim()
    if (!label) continue

    // The placeholder option's value is its own visible text, not "" - a
    // plain truthiness check on inputValue() misses that.
    const firstOptionValue = await sel
      .locator('option')
      .first()
      .getAttribute('value')
      .catch(() => null)
    const isUnanswered = current === '' || current === firstOptionValue
    if (!isUnanswered) continue // already answered (e.g. re-run) - don't touch it

    const optionTexts = await sel.locator('option').allTextContents()
    // A rule CAN match the label without its value existing as an option
    // (e.g. an experience-phrased label that's actually Yes/No) - must
    // still fall through to the next heuristic, not block.
    const rule = matchRule(rules, label)
    let choice = rule && pickOptionByRule(optionTexts, rule)
    if (!choice && looksLikeNoticeOptions(optionTexts)) {
      const noticeRule = rules.find((r) => r.kind === 'notice')
      if (noticeRule) choice = pickNoticeOption(optionTexts, noticeRule.days ?? 0)
    }
    if (!choice) choice = yesNoOptionMatch(optionTexts, true)
    const matched = Boolean(choice)
    // Nothing matched at all - pick the first real (non-placeholder) option
    // purely to keep walking forward; still recorded below as unmatched.
    if (!choice) choice = optionTexts.find((_, i) => optionTexts[i] !== optionTexts[0])

    await pace()
    if (choice) await sel.selectOption({ label: choice }).catch(() => {})
    const after = await sel.inputValue().catch(() => '')
    const verified = choice && after !== firstOptionValue && after !== ''
    if (!verified || !matched) unmatchedQuestions.push({ kind: 'select', label })
  }

  // Radio groups: fieldset+legend is the common pattern.
  const fieldsets = await modal.locator('fieldset').all()
  for (const fs of fieldsets) {
    const alreadyChecked = await fs.locator('input[type="radio"]:checked').count()
    if (alreadyChecked) continue
    const radios = await fs.locator('input[type="radio"]').all()
    if (!radios.length) continue
    const legend = (
      (await fs
        .locator('legend')
        .first()
        .textContent()
        .catch(() => '')) ?? ''
    ).trim()

    const optionLabels: string[] = []
    const optionLabelLocators: (Locator | null)[] = []
    for (const r of radios) {
      const rid = await r.getAttribute('id')
      let t = ''
      let lblLoc: Locator | null = null
      if (rid) {
        const lbl = fs.locator(`label[for="${cssEscapeId(rid)}"]`)
        if (await lbl.count()) {
          t = ((await lbl.textContent()) ?? '').trim()
          lblLoc = lbl
        }
      }
      optionLabels.push(t)
      optionLabelLocators.push(lblLoc)
    }

    const rule = matchRule(rules, legend)
    let wantText = rule && pickOptionByRule(optionLabels, rule)
    if (!wantText) wantText = yesNoOptionMatch(optionLabels, true)
    const matched = Boolean(wantText)
    // Nothing matched at all - fall back to the first real option purely to
    // keep walking forward; still recorded below as unmatched.
    if (!wantText) wantText = optionLabels[0]
    const idx = wantText ? optionLabels.indexOf(wantText) : -1
    const label = legend || '(no legend)'
    if (idx === -1) {
      unmatchedQuestions.push({ kind: 'radio', label })
      continue
    }

    // Click the <label>, not .check() on the <input> - these radios are
    // frequently visually-hidden with a styled label doing the real click
    // handling (React onChange listens for the click).
    await pace()
    const clickTarget = optionLabelLocators[idx] ?? radios[idx]
    await clickTarget.click({ force: true }).catch(() => {})
    const nowChecked = await radios[idx].isChecked().catch(() => false)
    if (!nowChecked || !matched) unmatchedQuestions.push({ kind: 'radio', label })
  }

  return { blocked: false, unmatchedQuestions }
}

export async function discardModal(page: Page, modal: Locator): Promise<void> {
  const dismiss = modal.locator('button[aria-label="Dismiss"]').first()
  if (await dismiss.count()) await dismiss.click().catch(() => {})
  else await page.keyboard.press('Escape').catch(() => {})
  await sleep(600)
  const discardBtn = page.locator('button:has-text("Discard")')
  if (await discardBtn.count()) {
    await pace()
    await discardBtn.click().catch(() => {})
  }
  await sleep(500)
}

const MAX_STEPS = 15

/**
 * Assumes the caller already navigated to the job's apply URL (so the
 * modal, if any, is already open) and built `rules` from the JD text
 * already visible on the underlying page.
 */
export async function stepThroughModal(
  page: Page,
  rules: Rule[],
  dryRun: boolean
): Promise<ApplyResult> {
  const modal = page.locator('div[role="dialog"]').first()
  if (!(await modal.count())) {
    return {
      outcome: 'skipped',
      reason: 'no apply modal opened (already applied, or posting no longer Easy Apply)'
    }
  }
  const header = (
    (await modal
      .locator('h2')
      .first()
      .textContent()
      .catch(() => '')) ?? ''
  ).trim()

  // Every field across every step that had no real answer - a field never
  // stops the walk on its own (see answerVisibleFields), it's just filled
  // with a placeholder and recorded here so later questions on this step
  // and subsequent ones still get discovered. Non-empty at the end means
  // this pass never actually submits, dry run or not - see the Submit
  // handling below.
  const collected: UnmatchedQuestion[] = []
  const collectUnmatched = (found: UnmatchedQuestion[]): void => {
    for (const q of found) {
      if (!collected.some((c) => c.kind === q.kind && c.label === q.label)) collected.push(q)
    }
  }

  const stuck = async (reason: string): Promise<ApplyResult> => {
    await discardModal(page, modal)
    return {
      outcome: 'needs_review',
      reason,
      header,
      unmatchedQuestions: collected.length ? collected : undefined
    }
  }

  for (let step = 0; step < MAX_STEPS; step++) {
    await sleep(500)

    const fillRes = await answerVisibleFields(modal, rules)
    collectUnmatched(fillRes.unmatchedQuestions)
    // The one true hard stop: a required file/photo upload isn't
    // automatable at all, so there's nothing left to try on this step.
    if (fillRes.blocked) return stuck(fillRes.reason ?? 'blocked')
    await pace()

    // A typeahead field answered earlier can leave its suggestion dropdown
    // mounted (visually stale) and it intercepts clicks on whatever's
    // underneath - close it by clicking neutral ground before advancing.
    if (
      await modal
        .locator('[data-test-single-typeahead-entity-form-search-result]')
        .first()
        .count()
        .catch(() => 0)
    ) {
      await modal
        .locator('h2')
        .first()
        .click({ force: true })
        .catch(() => {})
      await sleep(400)
    }

    // LinkedIn's aria-label on these buttons is not the visible text, so
    // getByRole name-matching misses them - match visible text instead.
    const submitBtn = modal.locator('button:has-text("Submit application")')
    if (await submitBtn.count()) {
      // Reached the end with at least one question we couldn't really
      // answer along the way - never actually submit on placeholder values,
      // dry run or not. Everything collected is what's worth reviewing.
      if (collected.length)
        return stuck('reached submit, but had unmatched questions along the way')
      if (dryRun) {
        await discardModal(page, modal)
        return { outcome: 'dry_run_ok', header }
      }
      await pace()
      try {
        await submitBtn.click({ timeout: 8000 })
      } catch {
        return {
          outcome: 'error',
          header,
          reason:
            'Submit click was blocked by an overlay - application state unclear, check manually'
        }
      }
      await sleep(2500)
      // Checking modal.count() here is wrong: LinkedIn commonly replaces the
      // apply modal with its own "Application sent" confirmation dialog on
      // success, which is still a div[role="dialog"] and made a real apply
      // read back as 'error' ("modal still open"). The Submit button itself
      // is the reliable signal - it's gone in both success paths (modal
      // closed outright, or replaced by the confirmation) and only remains
      // if the submit genuinely never went through.
      const submitStillThere = await submitBtn.count().catch(() => 0)
      return {
        outcome: submitStillThere ? 'error' : 'applied',
        header,
        reason: submitStillThere ? 'modal still open after submit click' : undefined
      }
    }

    const nextBtn = modal.locator('button:has-text("Review"), button:has-text("Next")').last()
    if (!(await nextBtn.count())) {
      return stuck('no next/review/submit control found')
    }
    if (await nextBtn.isDisabled().catch(() => true)) {
      return stuck('primary button disabled (unanswered required field)')
    }
    const before = await modal.innerText().catch(() => '')
    await pace()
    try {
      await nextBtn.click({ timeout: 8000 })
    } catch {
      return stuck('Next/Review click was blocked by an overlay')
    }
    await sleep(700)
    const after = await modal.innerText().catch(() => '')
    if (after === before) {
      // Click didn't advance - LinkedIn's own validation rejected
      // something our fill pass thought was fine. Don't spin on it.
      return stuck('step did not advance after clicking Next/Review (unrecognized required field?)')
    }
  }

  return stuck('exceeded max steps')
}

/**
 * Builds field-matching rules from the JD text plus the locally loaded
 * AnswerBank, then steps through whatever Easy Apply modal is already open
 * on `page`. Shared by both the direct-URL apply path (adapter.ts's
 * applyToJob) and the in-place search-results apply path
 * (searchPaneApply.ts) - the two differ only in how they got the modal
 * open, not in how they fill it out.
 */
export async function stepThroughEasyApplyModal(
  page: Page,
  jdText: string,
  dryRun: boolean
): Promise<ApplyResult> {
  const answers = loadAnswerBank()
  const rules = buildRules(answers, jdText)
  return stepThroughModal(page, rules, dryRun)
}
