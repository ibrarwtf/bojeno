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
  yesNoOptionMatch
} from './applyRules'
import type { Rule } from './applyRules'

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
const pace = (min = 500, max = 1500): Promise<void> =>
  sleep(Math.floor(Math.random() * (max - min) + min))

export function buildApplyUrl(jobId: string): string {
  return `https://www.linkedin.com/jobs/view/${jobId}/apply/?openSDUIApplyFlow=true`
}

function cssEscapeId(id: string): string {
  return id.replace(/([^\w-])/g, '\\$1')
}

interface FillResult {
  blocked: boolean
  reason?: string
}

/**
 * Answers every recognizable field on the current modal step. Returns
 * {blocked:false} if the step is fully handled (or had nothing to fill -
 * e.g. contact info already prefilled by LinkedIn), or {blocked:true,
 * reason} the moment a required field has no matching rule. Never guesses
 * past that point.
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
      return { blocked: true, reason: 'requires a file/photo upload - not automatable' }
    }
  }

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
    if (!rule) return { blocked: true, reason: `unmatched question (text): "${label}"` }

    // Typeahead fields (e.g. "Location (city)") are role=combobox.
    const isTypeahead = (await inp.getAttribute('role').catch(() => null)) === 'combobox'

    await pace()
    await inp.fill(rule.value ?? '')

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
    if (!after) return { blocked: true, reason: `fill didn't verify for "${label}"` }
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
    if (!choice) return { blocked: true, reason: `unmatched question (select): "${label}"` }

    await pace()
    await sel.selectOption({ label: choice }).catch(() => {})
    const after = await sel.inputValue().catch(() => '')
    if (after === firstOptionValue || after === '') {
      return { blocked: true, reason: `select didn't verify for "${label}"` }
    }
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
    const idx = wantText ? optionLabels.indexOf(wantText) : -1
    if (idx === -1) {
      return { blocked: true, reason: `unmatched question (radio): "${legend || '(no legend)'}"` }
    }

    // Click the <label>, not .check() on the <input> - these radios are
    // frequently visually-hidden with a styled label doing the real click
    // handling (React onChange listens for the click).
    await pace()
    const clickTarget = optionLabelLocators[idx] ?? radios[idx]
    await clickTarget.click({ force: true }).catch(() => {})
    const nowChecked = await radios[idx].isChecked().catch(() => false)
    if (!nowChecked) return { blocked: true, reason: `radio didn't verify for "${legend}"` }
  }

  return { blocked: false }
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

  for (let step = 0; step < MAX_STEPS; step++) {
    await sleep(500)

    const fillRes = await answerVisibleFields(modal, rules)
    if (fillRes.blocked) {
      await discardModal(page, modal)
      return { outcome: 'needs_review', reason: fillRes.reason, header }
    }
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
      const stillOpen = await modal.count()
      return {
        outcome: stillOpen ? 'error' : 'applied',
        header,
        reason: stillOpen ? 'modal still open after submit click' : undefined
      }
    }

    const nextBtn = modal.locator('button:has-text("Review"), button:has-text("Next")').last()
    if (!(await nextBtn.count())) {
      await discardModal(page, modal)
      return { outcome: 'needs_review', reason: 'no next/review/submit control found', header }
    }
    if (await nextBtn.isDisabled().catch(() => true)) {
      await discardModal(page, modal)
      return {
        outcome: 'needs_review',
        reason: 'primary button disabled (unanswered required field)',
        header
      }
    }
    const before = await modal.innerText().catch(() => '')
    await pace()
    try {
      await nextBtn.click({ timeout: 8000 })
    } catch {
      await discardModal(page, modal)
      return {
        outcome: 'needs_review',
        reason: 'Next/Review click was blocked by an overlay',
        header
      }
    }
    await sleep(700)
    const after = await modal.innerText().catch(() => '')
    if (after === before) {
      // Click didn't advance - LinkedIn's own validation rejected
      // something our fill pass thought was fine. Don't spin on it.
      await discardModal(page, modal)
      return {
        outcome: 'needs_review',
        reason: 'step did not advance after clicking Next/Review (unrecognized required field?)',
        header
      }
    }
  }

  await discardModal(page, modal)
  return { outcome: 'needs_review', reason: 'exceeded max steps', header }
}
