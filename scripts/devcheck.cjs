#!/usr/bin/env node
// Reusable CDP verification helper — connects to the app started by
// `npm run dev`, finds the renderer page, evaluates an expression against
// it, and prints the (JSON-serialized) result. Replaces hand-writing a
// throwaway script for every "does this actually work against the real
// app" check.
//
// Usage:
//   npm run devcheck -- "window.bojeno.checkLogin('linkedin')"
//   node scripts/devcheck.cjs "window.bojeno.fetchAppliedCount('naukri')"

const { chromium } = require('playwright-core')
const { readFileSync } = require('fs')
const { join } = require('path')

async function main() {
  const expr = process.argv.slice(2).join(' ')
  if (!expr) {
    console.error('Usage: npm run devcheck -- "<expression to eval in the renderer>"')
    console.error(`Example: npm run devcheck -- "window.bojeno.checkLogin('linkedin')"`)
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
    .find((candidate) => candidate.url().includes('localhost:5173'))

  if (!page) {
    console.error('Could not find the renderer page over CDP — is the app window open?')
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
