import { ElectronAPI } from '@electron-toolkit/preload'
import type { BojenoApi } from './index'

declare global {
  interface Window {
    electron: ElectronAPI
    bojeno: BojenoApi
  }
}
