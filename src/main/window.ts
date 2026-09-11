import { BrowserWindow, WebContentsView, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { instanceId } from './instance'
import type { ActiveTabUrl, Platform, Source } from '../shared/types'
import { IpcChannels } from '../shared/ipc-contract'

const LEFT_PANE_WIDTH = 260
const STATUS_BAR_HEIGHT = 56
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
let views: Record<Source, WebContentsView> | undefined
let activePlatform: Source = 'linkedin'

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
  for (const source of Object.keys(views) as Source[]) {
    views[source].setBounds(bounds)
    views[source].setVisible(source === activePlatform)
  }
}

function notifyActiveTabUrl(): void {
  if (!mainWindow || !views) return
  const url = views[activePlatform].webContents.getURL()
  const payload: ActiveTabUrl = { platform: activePlatform, url }
  mainWindow.webContents.send(IpcChannels.platformActiveTabUrlChanged, payload)
}

function createPlatformView(source: Source): WebContentsView {
  const view = new WebContentsView({
    webPreferences: {
      partition: `persist:${source}-${instanceId}`,
      sandbox: false
    }
  })
  view.setBackgroundColor('#00000000')
  view.webContents.on('did-navigate', () => {
    if (source === activePlatform) notifyActiveTabUrl()
  })
  view.webContents.on('did-navigate-in-page', () => {
    if (source === activePlatform) notifyActiveTabUrl()
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
    naukri: createPlatformView('naukri'),
    // No login/home page - stays about:blank until an apply action navigates
    // it via showLeverTab. Not selectable from the sidebar (see Sidebar.tsx);
    // it's shown automatically when a Lever apply is in flight.
    lever: createPlatformView('lever')
  }
  mainWindow.contentView.addChildView(views.linkedin)
  mainWindow.contentView.addChildView(views.naukri)
  mainWindow.contentView.addChildView(views.lever)
  layoutViews()

  return mainWindow
}

export function activateTab(platform: Platform, navigateToLogin?: boolean): void {
  activePlatform = platform
  layoutViews()
  if (navigateToLogin && views) {
    views[platform].webContents.loadURL(platformLoginUrl[platform])
  } else {
    ensurePlatformViewLoaded(platform)
  }
  notifyActiveTabUrl()
}

/**
 * Switches the docked pane to the Lever tab and navigates it to `url` -
 * called by adapters/lever/apply.ts right before it looks up the page over
 * CDP, so the apply flow is visible in the same pane LinkedIn/Naukri use
 * instead of popping a separate window.
 */
export function showLeverTab(url: string): void {
  if (!views) return
  activePlatform = 'lever'
  views.lever.webContents.loadURL(url)
  layoutViews()
  notifyActiveTabUrl()
}

export function getActiveTabUrl(): ActiveTabUrl {
  return { platform: activePlatform, url: views?.[activePlatform].webContents.getURL() ?? '' }
}
