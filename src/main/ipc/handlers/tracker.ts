import { ipcMain } from 'electron'
import { IpcChannels } from '../channels'
import { getDb } from '../../db'
import { getAppliedCountHistory } from '../../db/queries/appliedCounts'
import { getRecentRunLogs } from '../../db/queries/runLogs'
import { getApplyRateForPlatform } from '../../db/queries/ledger'
import {
  listUnresolvedUnmatchedQuestions,
  resolveUnmatchedQuestion
} from '../../db/queries/unmatchedQuestions'
import { insertUnmatchedQuestionAndNotify } from '../../notifications/unmatchedQuestionNotifier'
import { appSessionStartedAt } from '../../appSession'
import type { Platform } from '../../../shared/types'

export function registerTrackerHandlers(): void {
  ipcMain.handle(IpcChannels.trackerGetAppliedCountHistory, () => getAppliedCountHistory(getDb()))
  ipcMain.handle(IpcChannels.trackerGetApplyRate, (_event, platform: Platform) =>
    getApplyRateForPlatform(getDb(), platform)
  )
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
  // Manual verification helper for #83's notification, not part of the real
  // apply flow - see unmatchedQuestionNotifier.ts's doc comment.
  ipcMain.handle(IpcChannels.trackerCreateTestUnmatchedQuestion, () =>
    insertUnmatchedQuestionAndNotify(getDb(), {
      platform: 'linkedin',
      externalJobId: `test-${Date.now()}`,
      jobUrl: 'https://www.linkedin.com/jobs/view/test/',
      jobTitle: 'Test Job',
      company: 'Test Company',
      questionKind: 'text',
      questionLabel: 'This is a test notification - safe to ignore'
    })
  )
}
