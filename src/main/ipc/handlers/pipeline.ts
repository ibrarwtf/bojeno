import { ipcMain } from 'electron'
import { IpcChannels } from '../channels'
import { getDb } from '../../db'
import {
  deletePipelineContact,
  getPipelineContact,
  insertPipelineContact,
  listFollowUpsDue,
  listPipelineContacts,
  updatePipelineContact
} from '../../db/queries/pipelineContacts'
import type {
  CreatePipelineContactArgs,
  PipelineContactRow,
  UpdatePipelineContactArgs
} from '../../../shared/types'

/** Default follow-up threshold - see listFollowUpsDue and brief §2 row 4. */
const FOLLOW_UP_THRESHOLD_DAYS = 3

export function registerPipelineHandlers(): void {
  ipcMain.handle(IpcChannels.pipelineListContacts, () => listPipelineContacts(getDb()))
  ipcMain.handle(
    IpcChannels.pipelineCreateContact,
    (_event, args: CreatePipelineContactArgs): PipelineContactRow => {
      const db = getDb()
      const id = insertPipelineContact(db, args)
      const row = getPipelineContact(db, id)
      if (!row) throw new Error(`pipeline contact ${id} vanished right after insert`)
      return row
    }
  )
  ipcMain.handle(IpcChannels.pipelineUpdateContact, (_event, args: UpdatePipelineContactArgs) =>
    updatePipelineContact(getDb(), args)
  )
  ipcMain.handle(IpcChannels.pipelineDeleteContact, (_event, id: number) =>
    deletePipelineContact(getDb(), id)
  )
  ipcMain.handle(IpcChannels.pipelineListFollowUpsDue, () =>
    listFollowUpsDue(getDb(), FOLLOW_UP_THRESHOLD_DAYS)
  )
}
