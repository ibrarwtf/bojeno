#!/usr/bin/env node
// Kills stray electron.exe processes and any node.exe process running
// electron-vite, left over from a previous `npm run dev` that didn't shut
// down cleanly (common when a session gets interrupted mid-restart).
// Windows-only (uses PowerShell) — this project only has a Windows dev
// environment so far; revisit if that changes.

const { execSync } = require('child_process')

function run(description, psCommand) {
  console.log(description)
  try {
    execSync(psCommand, { stdio: 'inherit', shell: 'powershell.exe' })
  } catch {
    // No matching process is the common case, not an error.
  }
}

run(
  'Stopping stray electron.exe processes...',
  `Get-Process electron -ErrorAction SilentlyContinue | Stop-Process -Force`
)

run(
  'Stopping stray electron-vite node.exe processes...',
  `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ` +
    `Where-Object { $_.CommandLine -match 'electron-vite' } | ` +
    `ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`
)

console.log('Done.')
