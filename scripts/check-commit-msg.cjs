#!/usr/bin/env node
// Enforces the commit message format from CONTRIBUTING.md:
//   <type>(<scope>): #<issue> <imperative summary, no trailing period>
// Only the subject line (first line) is checked — body text is free-form.

const { readFileSync } = require('fs')

const TYPES = ['feat', 'fix', 'chore', 'refactor', 'docs', 'test', 'perf']
const SCOPES = [
  'linkedin',
  'naukri',
  'ats',
  'tracker',
  'engine',
  'db',
  'dashboard',
  'discovery',
  'ledger',
  'scheduler',
  'repo'
]

const messageFile = process.argv[2]
if (!messageFile) {
  console.error('Usage: node scripts/check-commit-msg.cjs <path-to-commit-msg-file>')
  process.exit(1)
}

const firstLine = readFileSync(messageFile, 'utf-8').split('\n')[0].trim()

// Merge/revert commits aren't written by hand against our convention.
if (/^(Merge |Revert )/.test(firstLine)) {
  process.exit(0)
}

const pattern = new RegExp(`^(${TYPES.join('|')})\\((${SCOPES.join('|')})\\): #\\d+ \\S.*[^.]$`)

if (!pattern.test(firstLine)) {
  console.error('Commit message does not match the required format:')
  console.error('  <type>(<scope>): #<issue> <imperative summary, no trailing period>')
  console.error('')
  console.error(`  types:  ${TYPES.join(' | ')}`)
  console.error(`  scopes: ${SCOPES.join(' | ')}`)
  console.error('')
  console.error(`Got: "${firstLine}"`)
  console.error('')
  console.error('If this genuinely has no issue/scope (rare), commit with SKIP_SIMPLE_GIT_HOOKS=1.')
  process.exit(1)
}

process.exit(0)
