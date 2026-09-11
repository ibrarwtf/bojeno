const locks = new Map<string, Promise<unknown>>()

/**
 * Serializes calls sharing the same id. Needed for adapter actions that
 * drive a WebContentsView's navigation — two concurrent calls against the
 * same page race each other's page.goto() into net::ERR_ABORTED.
 */
export function withLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const prior = locks.get(id) ?? Promise.resolve()
  const next = prior.then(fn, fn)
  locks.set(
    id,
    next.catch(() => undefined)
  )
  return next
}
