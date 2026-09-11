import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { setupRemoteDebugging } from './cdp'
import { createWindow } from './window'
import { registerLinkedinHandlers } from './ipc/handlers/linkedin'
import { registerNaukriHandlers } from './ipc/handlers/naukri'
import { registerPlatformHandlers } from './ipc/handlers/platform'

// Must run before app.whenReady() — Chromium only honors this switch pre-init.
setupRemoteDebugging()

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.bojeno.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerLinkedinHandlers()
  registerNaukriHandlers()
  registerPlatformHandlers()

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
