import { BrowserWindow, WebContentsView, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { instanceId } from './instance'
import type { ActiveTabUrl, Platform } from '../shared/types'
import { IpcChannels } from '../shared/ipc-contract'

const LEFT_PANE_WIDTH = 360
const URL_BAR_HEIGHT = 36

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

function layoutViews(): void {
  if (!mainWindow || !views) return
  const { width, height } = mainWindow.getContentBounds()
  const bounds = {
    x: LEFT_PANE_WIDTH,
    y: URL_BAR_HEIGHT,
    width: Math.max(width - LEFT_PANE_WIDTH, 0),
    height: Math.max(height - URL_BAR_HEIGHT, 0)
  }
  for (const platform of Object.keys(views) as Platform[]) {
    views[platform].setBounds(bounds)
    views[platform].setVisible(platform === activePlatform)
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
  view.webContents.loadURL(platformHomeUrl[platform])
  return view
}

export function createWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

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

export function activateTab(platform: Platform, navigateToLogin?: boolean): void {
  activePlatform = platform
  layoutViews()
  notifyActiveTabUrl()
  if (navigateToLogin && views) {
    views[platform].webContents.loadURL(platformLoginUrl[platform])
  }
}

export function getActiveTabUrl(): ActiveTabUrl {
  return { platform: activePlatform, url: views?.[activePlatform].webContents.getURL() ?? '' }
}
