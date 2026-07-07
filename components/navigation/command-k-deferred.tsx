"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"

import { useIdleMount } from "@/hooks/use-idle-mount"

const CommandK = dynamic(
  () => import("@/components/CommandK").then((m) => ({ default: m.CommandK })),
  { ssr: false }
)

/** Desktop-only ⌘K — skips cmdk + motion bundle on mobile; loads after idle on desktop. */
export function CommandKDeferred() {
  const [desktop, setDesktop] = useState(false)
  const idleReady = useIdleMount({ idleTimeoutMs: 2800, fallbackDelayMs: 800 })

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)")
    const sync = () => {
      if (mq.matches) setDesktop(true)
    }
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  if (!desktop || !idleReady) return null
  return <CommandK showTrigger={false} />
}
