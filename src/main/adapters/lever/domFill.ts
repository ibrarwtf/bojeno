/**
 * Fills a real Lever apply page via Playwright DOM interaction - no raw
 * HTML/multipart reconstruction. Verified live against a real board
 * (bazaarvoice): every custom question renders as `li.application-question`
 * containing a `.application-label .text` question and a textarea/select/
 * text input, while the built-in fields (name/email/phone/location/resume/
 * LinkedIn url) sit in their own untitled `li.application-question` rows
 * addressable directly by `name` attribute - so custom questions are found
 * by filtering to the ones that actually have a `.text` label, not by
 * looping every `li.application-question`.
 *
 * Never touches checkboxes, radio groups, the hCaptcha widget, or the
 * submit button - those are always left for the user to finish by hand in
 * the visible window this opens (see per-platform-independence memory:
 * career-ops found Lever pops hCaptcha off programmatic checkbox/radio
 * interaction, and there's no headless captcha solve path regardless).
 */
import type { Page, Locator } from 'playwright-core'
import type { AnswerBank } from '../../config/answerBank'
import { buildLeverRules, matchLeverRule, pickDropdownAnswer } from './questionRules'

export interface FillReport {
  filled: string[]
  skipped: { label: string; reason: string }[]
}

async function fillKnownField(
  page: Page,
  selector: string,
  value: string,
  label: string,
  report: FillReport
): Promise<void> {
  const field = page.locator(selector).first()
  if (!(await field.count())) return
  if (!value) {
    report.skipped.push({ label, reason: 'no value in answer bank' })
    return
  }
  await field.fill(value)
  report.filled.push(label)
}

function cleanLabel(text: string): string {
  return text.replace(/✱\s*$/, '').trim()
}

async function fillCustomQuestion(
  question: Locator,
  rules: ReturnType<typeof buildLeverRules>,
  report: FillReport
): Promise<void> {
  const labelText = cleanLabel(
    (await question
      .locator('.application-label .text')
      .first()
      .textContent()
      .catch(() => '')) ?? ''
  )
  if (!labelText) return

  if (await question.locator('input[type="checkbox"], input[type="radio"]').count()) {
    report.skipped.push({ label: labelText, reason: 'checkbox/radio - left for you to answer' })
    return
  }

  const select = question.locator('select')
  if (await select.count()) {
    const optionTexts = await select.locator('option').allTextContents()
    const desired = matchLeverRule(rules, labelText)
    const choice = desired ? pickDropdownAnswer(optionTexts, desired) : null
    if (!choice) {
      report.skipped.push({ label: labelText, reason: 'no matching rule' })
      return
    }
    await select.selectOption({ label: choice })
    report.filled.push(labelText)
    return
  }

  const textarea = question.locator('textarea')
  const textInput = question.locator('input[type="text"]')
  const target = (await textarea.count()) ? textarea : (await textInput.count()) ? textInput : null
  if (!target) return

  const value = matchLeverRule(rules, labelText)
  if (value === undefined) {
    report.skipped.push({ label: labelText, reason: 'no matching rule' })
    return
  }
  await target.fill(value)
  report.filled.push(labelText)
}

export async function fillLeverForm(page: Page, answers: AnswerBank): Promise<FillReport> {
  const report: FillReport = { filled: [], skipped: [] }
  const rules = buildLeverRules(answers)

  await fillKnownField(page, 'input[name="name"]', answers.full_name, 'name', report)
  await fillKnownField(page, 'input[name="email"]', answers.email, 'email', report)
  await fillKnownField(page, 'input[name="phone"]', answers.phone, 'phone', report)
  await fillKnownField(page, 'input[name="location"]', answers.current_city, 'location', report)
  await fillKnownField(
    page,
    'input[name="urls[LinkedIn]"]',
    answers.linkedin_profile_url,
    'LinkedIn URL',
    report
  )

  const resumeInput = page.locator('input[name="resume"]')
  if (await resumeInput.count()) {
    if (answers.resume_path) {
      await resumeInput.setInputFiles(answers.resume_path)
      report.filled.push('resume')
    } else {
      report.skipped.push({ label: 'resume', reason: 'no resume_path in answer bank' })
    }
  }

  const customQuestions = await page
    .locator('li.application-question:has(.application-label .text)')
    .all()
  for (const question of customQuestions) {
    await fillCustomQuestion(question, rules, report)
  }

  return report
}
