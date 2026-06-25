"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"

const CommandK = dynamic(
  () => import("@/components/CommandK").then((m) => ({ default: m.CommandK })),
  { ssr: false }
)

/** Desktop-only ⌘K — skips cmdk + motion bundle on mobile buyer paths. */
export function CommandKDeferred() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)")
    const sync = () => {
      if (mq.matches) setEnabled(true)
    }
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  if (!enabled) return null
  return <CommandK showTrigger={false} />
}
