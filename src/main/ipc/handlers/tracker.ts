import { ipcMain } from 'electron'
import { IpcChannels } from '../channels'
import { getDb } from '../../db'
import { getAppliedCountHistory } from '../../db/queries/appliedCounts'

export function registerTrackerHandlers(): void {
  ipcMain.handle(IpcChannels.trackerGetAppliedCountHistory, () => getAppliedCountHistory(getDb()))
}
