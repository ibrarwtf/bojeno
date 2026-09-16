import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { setupRemoteDebugging } from './cdp'
import { createWindow } from './window'
import { getDb } from './db'
import { registerLinkedinHandlers } from './ipc/handlers/linkedin'
import { registerNaukriHandlers } from './ipc/handlers/naukri'
import { registerPlatformHandlers } from './ipc/handlers/platform'
import { registerTrackerHandlers } from './ipc/handlers/tracker'
import { registerPipelineHandlers } from './ipc/handlers/pipeline'
// import { startScheduler } from './scheduler/runScheduler' // TEMPORARILY DISABLED, see below

// A second launch (a leftover process from an unclean previous dev session,
// or the app opened twice by hand) would otherwise run fully independently
// against the SAME sqlite file and open its own CDP debug port - two windows
// silently racing each other over the same DB and the same LinkedIn tab,
// exactly the class of bug `npm run dev`'s own kill-stray-process step exists
// to paper over for the dev case. This refuses that outright for every case,
// not just dev: the second process exits immediately below instead of
// proceeding, and the first process's existing window is focused instead.
const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const [existingWindow] = BrowserWindow.getAllWindows()
    if (existingWindow) {
      if (existingWindow.isMinimized()) existingWindow.restore()
      existingWindow.focus()
    }
  })

  // Must run before app.whenReady() — Chromium only honors this switch pre-init.
  setupRemoteDebugging()

  app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.bojeno.app')

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    getDb()

    registerLinkedinHandlers()
    registerNaukriHandlers()
    registerPlatformHandlers()
    registerTrackerHandlers()
    registerPipelineHandlers()

    createWindow()

    // After createWindow() - ensurePlatformViewLoaded (used by the run
    // pipeline a scheduled tick calls) is a no-op until the platform
    // WebContentsViews it navigates exist. See scheduler/runScheduler.ts.
    // TEMPORARILY DISABLED (local-only, not to be committed): every app
    // restart during this manual live-apply campaign resets the in-memory
    // lastTriggeredAt to null, so the passive scheduler immediately treats
    // itself as "due" and fires an unbounded dry-run tick that grabs the
    // activeRuns lock out from under the manually-driven runs. Re-enable
    // this line once the campaign is done.
    // startScheduler()

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
}
