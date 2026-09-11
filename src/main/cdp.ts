import { app } from 'electron'
import { chromium, type Browser, type Page } from 'playwright-core'

let debugPort: number | undefined
let browserPromise: Promise<Browser> | undefined

/**
 * Must be called before `app.whenReady()` — Chromium only honors this switch
 * when set before the app finishes initializing.
 */
export function setupRemoteDebugging(): number {
  if (debugPort !== undefined) return debugPort
  debugPort = 9200 + Math.floor(Math.random() * 800)
  app.commandLine.appendSwitch('remote-debugging-port', String(debugPort))
  return debugPort
}

function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    if (debugPort === undefined) {
      throw new Error('setupRemoteDebugging() must be called before getBrowser()')
    }
    browserPromise = chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`)
  }
  return browserPromise
}

/**
 * The CDP endpoint also exposes the app's own renderer window as a target,
 * so callers must select the page by URL rather than assuming index 0.
 */
export async function findPageByUrlPart(
  urlPart: string,
  { retries = 20, delayMs = 250 }: { retries?: number; delayMs?: number } = {}
): Promise<Page> {
  const browser = await getBrowser()
  for (let attempt = 0; attempt < retries; attempt++) {
    for (const context of browser.contexts()) {
      for (const page of context.pages()) {
        if (page.url().includes(urlPart)) {
          // The view's initial load may still be mid-redirect-chain (e.g. its
          // home page bouncing to a login wall) — settle it first so a
          // caller's own goto() isn't raced/aborted by that in-flight chain.
          await waitForStableUrl(page)
          return page
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
  throw new Error(`No CDP page found matching "${urlPart}" after ${retries} attempts`)
}

/**
 * Polls page.url() until it stops changing for two consecutive checks, up to
 * a timeout. A single 'load' event isn't enough here — a redirect chain
 * (e.g. home page bouncing through to a login wall) can fire 'load' on an
 * intermediate hop while another navigation is still pending.
 */
async function waitForStableUrl(
  page: Page,
  { settleMs = 400, timeoutMs = 8000 }: { settleMs?: number; timeoutMs?: number } = {}
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let lastUrl = page.url()
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, settleMs))
    const currentUrl = page.url()
    if (currentUrl === lastUrl) return
    lastUrl = currentUrl
  }
}

/**
 * Waits for the page's URL path to start with `pathPrefix`, up to a timeout.
 * Used for login checks: navigate to a platform's root URL, then wait to see
 * whether it redirects to the logged-in area (path arrives) or stays on a
 * login/landing page (times out) — not fighting the platform's own routing,
 * just watching where it lands.
 */
export async function waitForPathname(
  page: Page,
  pathPrefix: string,
  timeoutMs = 10000
): Promise<boolean> {
  return page
    .waitForFunction((path) => window.location.pathname.startsWith(path), pathPrefix, {
      timeout: timeoutMs
    })
    .then(() => true)
    .catch(() => false)
}

/**
 * Electron's own initial navigation can still be settling when a second
 * navigation is issued, aborting it with net::ERR_ABORTED — retry a few
 * times with a short backoff before giving up.
 */
export async function gotoWithRetry(
  page: Page,
  url: string,
  options: Parameters<Page['goto']>[1] = {},
  maxAttempts = 3
): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await page.goto(url, options)
      return
    } catch (error) {
      const isAborted = error instanceof Error && error.message.includes('ERR_ABORTED')
      if (!isAborted || attempt === maxAttempts) throw error
      await new Promise((resolve) => setTimeout(resolve, 300 * attempt))
    }
  }
}
