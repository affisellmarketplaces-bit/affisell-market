/**
 * Serializes async work so overlapping autosaves cannot race
 * (stale failure must not overwrite a newer success).
 */
export type SerialAsyncQueue = {
  enqueue: <T>(task: () => Promise<T>) => Promise<T>
}

export function createSerialAsyncQueue(): SerialAsyncQueue {
  let tail: Promise<unknown> = Promise.resolve()

  return {
    enqueue<T>(task: () => Promise<T>): Promise<T> {
      const next = tail.then(task, task)
      tail = next.then(
        () => undefined,
        () => undefined
      )
      return next
    },
  }
}

/** True when this attempt is still the latest scheduled generation. */
export function isLatestAutosaveGeneration(attempt: number, current: number): boolean {
  return attempt === current
}
