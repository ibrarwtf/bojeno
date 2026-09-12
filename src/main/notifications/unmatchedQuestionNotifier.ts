import { Notification } from 'electron'
import type { DatabaseSync } from 'node:sqlite'
import {
  insertUnmatchedQuestion,
  hasNotifiedUnresolvedQuestion,
  markUnmatchedQuestionNotified,
  type UnmatchedQuestionArgs
} from '../db/queries/unmatchedQuestions'
import { focusMainWindow } from '../window'

/**
 * Inserts a new unmatched_questions row and, unless an unresolved row for
 * the exact same platform/job/question has already been notified about
 * (e.g. a retried apply attempt hitting the same screening question again),
 * fires a native OS notification for it.
 *
 * This is the review queue's one notifier today (bojeno-project-brief.md
 * §3: anything needing a decision goes on the review queue, and a
 * notification fires so the owner can act on it in a batch). It's named
 * after the table it watches rather than a generic "review queue notifier"
 * abstraction, since unmatched_questions is still the only source - a
 * second source can get its own equivalently-named notifier when it
 * actually exists, rather than factoring one out now.
 *
 * Returns whether a notification actually fired - callers don't need it
 * (fire-and-forget from the apply flow), but it's what
 * tracker:createTestUnmatchedQuestion reports back for live verification.
 */
export function insertUnmatchedQuestionAndNotify(
  db: DatabaseSync,
  args: UnmatchedQuestionArgs
): boolean {
  const alreadyNotified = hasNotifiedUnresolvedQuestion(
    db,
    args.platform,
    args.externalJobId,
    args.questionLabel
  )
  const id = insertUnmatchedQuestion(db, args)
  if (alreadyNotified) return false

  const fired = fireNotification(args)
  if (fired) markUnmatchedQuestionNotified(db, id)
  return fired
}

function fireNotification(args: Pick<UnmatchedQuestionArgs, 'jobTitle' | 'company'>): boolean {
  if (!Notification.isSupported()) return false

  const where = [args.jobTitle, args.company].filter(Boolean).join(' at ')
  const notification = new Notification({
    title: '1 new screening question needs an answer',
    body: where || 'Open Bojeno to review it.'
  })
  // Not every OS/notification-center surfaces click events (Electron docs:
  // "on Linux ... shown notifications will remain until either the
  // notification times out or is dismissed" - click support varies) - when
  // it doesn't fire, the owner still has the review queue on Home, this is
  // just a shortcut there.
  notification.on('click', () => focusMainWindow())
  notification.show()
  return true
}
