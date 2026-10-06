/**
 * Undo / redo over whole-design snapshots — pure, generic, no React.
 *
 * Every Generate-with-AI button and every preset overwrites many fields at once; without history a merchant who dislikes
 * the result has no way back. The history stores snapshots (not diffs): a design is ~20 small fields, and restoring a
 * snapshot is one atomic, obviously-correct operation.
 */
export type History<T> = {
  /** Oldest first. */
  past: readonly T[]
  present: T
  /** Next redo first. */
  future: readonly T[]
}

/** Enough to walk back through a long session without letting memory grow unbounded. */
export const HISTORY_LIMIT = 50

export function createHistory<T>(initial: T): History<T> {
  return { past: [], present: initial, future: [] }
}

/**
 * Records `next` as the new present. A no-op (same object returned) when it equals the current present — which is also
 * what makes applying an undo/redo result harmless when the caller feeds it back in. A genuine change clears the redo
 * stack, as in every editor.
 */
export function recordChange<T>(history: History<T>, next: T, equal: (a: T, b: T) => boolean): History<T> {
  if (equal(history.present, next)) return history
  const past = [...history.past, history.present]
  const trimmed = past.length > HISTORY_LIMIT ? past.slice(past.length - HISTORY_LIMIT) : past
  return { past: trimmed, present: next, future: [] }
}

export function canUndo<T>(history: History<T>): boolean {
  return history.past.length > 0
}

export function canRedo<T>(history: History<T>): boolean {
  return history.future.length > 0
}

export function undo<T>(history: History<T>): History<T> {
  if (!canUndo(history)) return history
  const previous = history.past[history.past.length - 1]!
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  }
}

export function redo<T>(history: History<T>): History<T> {
  if (!canRedo(history)) return history
  const [next, ...rest] = history.future
  return { past: [...history.past, history.present], present: next!, future: rest }
}
