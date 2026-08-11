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

type CoalescingWaiter = {
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
}

/**
 * Serial autosave queue that collapses burst enqueues into a single flush:
 * only the latest task runs after the current one finishes; all waiters share its result.
 */
export function createCoalescingSerialAsyncQueue(): SerialAsyncQueue {
  let running = false
  let pendingTask: (() => Promise<unknown>) | null = null
  let pendingWaiters: CoalescingWaiter[] = []

  const flush = async (): Promise<void> => {
    running = true
    while (pendingTask) {
      const task = pendingTask
      const waiters = pendingWaiters
      pendingTask = null
      pendingWaiters = []
      try {
        const result = await task()
        for (const waiter of waiters) waiter.resolve(result)
      } catch (error) {
        for (const waiter of waiters) waiter.reject(error)
      }
    }
    running = false
  }

  return {
    enqueue<T>(task: () => Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        pendingWaiters.push({
          resolve: resolve as (value: unknown) => void,
          reject,
        })
        pendingTask = task as () => Promise<unknown>
        if (!running) void flush()
      })
    },
  }
}

/** True when this attempt is still the latest scheduled generation. */
export function isLatestAutosaveGeneration(attempt: number, current: number): boolean {
  return attempt === current
}
