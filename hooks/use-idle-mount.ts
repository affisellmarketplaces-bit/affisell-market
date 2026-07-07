import { useEffect, useState } from "react"

import { scheduleIdleTask } from "@/lib/schedule-idle-task"

type Options = {
  idleTimeoutMs?: number
  fallbackDelayMs?: number
}

/** Returns true after idle — use to defer heavy client trees (catalog, cookies, hub). */
export function useIdleMount(options: Options = {}): boolean {
  const { idleTimeoutMs = 2200, fallbackDelayMs = 450 } = options
  const [ready, setReady] = useState(false)

  useEffect(() => scheduleIdleTask(() => setReady(true), idleTimeoutMs, fallbackDelayMs), [
    idleTimeoutMs,
    fallbackDelayMs,
  ])

  return ready
}
