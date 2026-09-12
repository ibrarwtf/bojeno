import { ipcMain } from 'electron'
import { IpcChannels } from '../channels'
import { getDb } from '../../db'
import { getAppliedCountHistory } from '../../db/queries/appliedCounts'
import { getRecentRunLogs } from '../../db/queries/runLogs'
import {
  listUnresolvedUnmatchedQuestions,
  resolveUnmatchedQuestion
} from '../../db/queries/unmatchedQuestions'
import { appSessionStartedAt } from '../../appSession'

export function registerTrackerHandlers(): void {
  ipcMain.handle(IpcChannels.trackerGetAppliedCountHistory, () => getAppliedCountHistory(getDb()))
  ipcMain.handle(IpcChannels.trackerGetRunLogs, () =>
    getRecentRunLogs(getDb(), 50, appSessionStartedAt)
  )
  ipcMain.handle(IpcChannels.trackerGetUnmatchedQuestions, () =>
    listUnresolvedUnmatchedQuestions(getDb())
  )
  ipcMain.handle(
    IpcChannels.trackerResolveUnmatchedQuestion,
    (_event, id: number, answer: string) => resolveUnmatchedQuestion(getDb(), id, answer)
  )
}
