import { BrowserWindow, WebContentsView, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { instanceId } from './instance'
import type { ActiveTabUrl, Platform } from '../shared/types'
import { IpcChannels } from '../shared/ipc-contract'

// Icon-only nav rail (.sidebar) + the LinkedIn Saved Searches panel beside it
// (.linkedin-saved-searches). Naukri's own workspace, when built, may need a
// different total - this isn't assumed to be shared geometry.
const RAIL_WIDTH = 64
const SAVED_SEARCHES_WIDTH = 296
const LEFT_PANE_WIDTH = RAIL_WIDTH + SAVED_SEARCHES_WIDTH
// Height of the .linkedin-account-header block above the browser view. Naukri's own
// workspace/header (when built) is expected to need its own geometry, not this one.
const STATUS_BAR_HEIGHT = 44
const URL_BAR_HEIGHT = 36
const LOG_PANEL_HEIGHT = 160

const platformHomeUrl: Record<Platform, string> = {
  linkedin: 'https://www.linkedin.com',
  naukri: 'https://www.naukri.com'
}

const platformLoginUrl: Record<Platform, string> = {
  linkedin: 'https://www.linkedin.com/login',
  naukri: 'https://www.naukri.com/nlogin/login'
}

let mainWindow: BrowserWindow | undefined
let views: Record<Platform, WebContentsView> | undefined
let activePlatform: Platform = 'linkedin'
// Home is the default landing screen - true until the user selects a platform, and
// again whenever they navigate back to Home. No platform view should be visible then.
let homeActive = true

function layoutViews(): void {
  if (!mainWindow || !views) return
  const { width, height } = mainWindow.getContentBounds()
  const top = STATUS_BAR_HEIGHT + URL_BAR_HEIGHT
  const bounds = {
    x: LEFT_PANE_WIDTH,
    y: top,
    width: Math.max(width - LEFT_PANE_WIDTH, 0),
    height: Math.max(height - top - LOG_PANEL_HEIGHT, 0)
  }
  for (const platform of Object.keys(views) as Platform[]) {
    views[platform].setBounds(bounds)
    views[platform].setVisible(!homeActive && platform === activePlatform)
  }
}

function notifyActiveTabUrl(): void {
  if (!mainWindow || !views) return
  const url = views[activePlatform].webContents.getURL()
  const payload: ActiveTabUrl = { platform: activePlatform, url }
  mainWindow.webContents.send(IpcChannels.platformActiveTabUrlChanged, payload)
}

function createPlatformView(platform: Platform): WebContentsView {
  const view = new WebContentsView({
    webPreferences: {
      partition: `persist:${platform}-${instanceId}`,
      sandbox: false
    }
  })
  view.setBackgroundColor('#00000000')
  view.webContents.on('did-navigate', () => {
    if (platform === activePlatform) notifyActiveTabUrl()
  })
  view.webContents.on('did-navigate-in-page', () => {
    if (platform === activePlatform) notifyActiveTabUrl()
  })
  // Loaded to about:blank rather than the platform's real home page - see
  // ensurePlatformViewLoaded. Loading both platforms' home pages
  // unconditionally on every app launch meant every `npm run dev` restart
  // during development was itself a real hit against LinkedIn/Naukri, which
  // is exactly the kind of unnecessary traffic that risks a rate limit or a
  // flagged session. A committed about:blank navigation (rather than an
  // never-navigated view) is required here, not optional - Playwright's CDP
  // client hangs indefinitely trying to attach to a WebContentsView target
  // with no frame ever committed, which blocks devcheck/adapter connections
  // for every page, not just this one.
  view.webContents.loadURL('about:blank')
  return view
}

/**
 * Navigates a platform's view to its home page only if it hasn't already -
 * called right before any adapter action that needs the page (via
 * findPageByUrlPart), and when the user switches to a tab. A fresh
 * WebContentsView's URL is empty/"about:blank" until this runs once.
 */
export function ensurePlatformViewLoaded(platform: Platform): void {
  if (!views) return
  const currentUrl = views[platform].webContents.getURL()
  if (currentUrl && currentUrl !== 'about:blank') return
  views[platform].webContents.loadURL(platformHomeUrl[platform])
}

export function createWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    title: '⍢ Bojeno',
    width: 1280,
    height: 800,
    show: false,
    // Matches the renderer's --ev-c-black background - Electron's own window
    // default is white, which flashes visibly for a frame before the (dark)
    // renderer paints, especially once child WebContentsViews are attached.
    backgroundColor: '#1b1b1f',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // The renderer's own <title> would otherwise win once it loads.
  mainWindow.on('page-title-updated', (event) => event.preventDefault())
  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.on('resize', layoutViews)
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  views = {
    linkedin: createPlatformView('linkedin'),
    naukri: createPlatformView('naukri')
  }
  mainWindow.contentView.addChildView(views.linkedin)
  mainWindow.contentView.addChildView(views.naukri)
  layoutViews()

  return mainWindow
}

export function showHome(): void {
  homeActive = true
  layoutViews()
}

export function activateTab(platform: Platform, navigateToLogin?: boolean): void {
  activePlatform = platform
  homeActive = false
  layoutViews()
  if (navigateToLogin && views) {
    views[platform].webContents.loadURL(platformLoginUrl[platform])
  } else {
    ensurePlatformViewLoaded(platform)
  }
  notifyActiveTabUrl()
}

export function getActiveTabUrl(): ActiveTabUrl {
  return { platform: activePlatform, url: views?.[activePlatform].webContents.getURL() ?? '' }
}
