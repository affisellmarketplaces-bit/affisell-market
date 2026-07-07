/** Defer work until the browser is idle — lowers TBT on first paint. */
export function scheduleIdleTask(
  run: () => void,
  idleTimeoutMs = 2000,
  fallbackDelayMs = 400
): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(run, { timeout: idleTimeoutMs })
    return () => window.cancelIdleCallback(id)
  }
  const t = window.setTimeout(run, fallbackDelayMs)
  return () => window.clearTimeout(t)
}
