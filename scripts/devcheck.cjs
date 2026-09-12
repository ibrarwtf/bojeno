#!/usr/bin/env node
// Reusable CDP verification helper — connects to the app started by
// `npm run dev`, finds a page, evaluates an expression against it, and
// prints the (JSON-serialized) result. Replaces hand-writing a throwaway
// script for every "does this actually work against the real app" check.
// Targets the renderer by default; pass --page=<url-substring> to target a
// platform's own WebContentsView instead (e.g. --page=linkedin.com) so
// inspecting/driving a live LinkedIn/Naukri page doesn't need its own
// one-off script either.
//
// Usage:
//   npm run devcheck -- "window.bojeno.checkLogin('linkedin')"
//   npm run devcheck -- --page=linkedin.com "document.title"
//   node scripts/devcheck.cjs "window.bojeno.fetchAppliedCount('naukri')"

const { chromium } = require('playwright-core')
const { readFileSync } = require('fs')
const { join } = require('path')

async function main() {
  const args = process.argv.slice(2)
  const pageFlag = args.find((a) => a.startsWith('--page='))
  const pageMatch = pageFlag ? pageFlag.slice('--page='.length) : 'localhost:5173'
  const expr = args.filter((a) => a !== pageFlag).join(' ')

  if (!expr) {
    console.error('Usage: npm run devcheck -- [--page=<url-substring>] "<expression to eval>"')
    console.error(`Example: npm run devcheck -- "window.bojeno.checkLogin('linkedin')"`)
    console.error(`Example: npm run devcheck -- --page=linkedin.com "document.title"`)
    process.exit(1)
  }

  const portFile = join(__dirname, '..', '.dev', 'cdp-port')
  let port
  try {
    port = readFileSync(portFile, 'utf-8').trim()
  } catch {
    console.error(`Could not read ${portFile} — is "npm run dev" currently running?`)
    process.exit(1)
  }

  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`)
  const page = browser
    .contexts()
    .flatMap((context) => context.pages())
    .find((candidate) => candidate.url().includes(pageMatch))

  if (!page) {
    console.error(
      `Could not find a page matching "${pageMatch}" over CDP — is the app window open?`
    )
    process.exit(1)
  }

  const pageFunction = new Function(`return (${expr})`)
  const result = await page.evaluate(pageFunction)
  console.log(JSON.stringify(result, null, 2))
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
