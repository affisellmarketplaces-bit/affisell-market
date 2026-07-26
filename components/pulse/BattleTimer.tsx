"use client"

import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"

type Props = {
  endsAt: string | null
  timeLeftMs?: number
  onEnd?: () => void
  className?: string
}

function formatMs(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

/**
 * Battle countdown mm:ss — pulses red under 1 minute.
 */
export function BattleTimer({ endsAt, timeLeftMs, onEnd, className }: Props) {
  const [left, setLeft] = useState(() => {
    if (typeof timeLeftMs === "number") return Math.max(0, timeLeftMs)
    if (!endsAt) return 0
    return Math.max(0, new Date(endsAt).getTime() - Date.now())
  })

  useEffect(() => {
    if (typeof timeLeftMs === "number") setLeft(Math.max(0, timeLeftMs))
  }, [timeLeftMs])

  useEffect(() => {
    const tick = () => {
      const next = endsAt
        ? Math.max(0, new Date(endsAt).getTime() - Date.now())
        : Math.max(0, left - 1000)
      setLeft(next)
      if (next <= 0) onEnd?.()
    }
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onEnd stable enough
  }, [endsAt])

  const urgent = left > 0 && left < 60_000

  return (
    <div
      className={cn(
        "tabular-nums text-sm font-black tracking-wider",
        urgent ? "animate-pulse text-red-500" : "text-white",
        className
      )}
      data-testid="battle-timer"
    >
      {formatMs(left)}
    </div>
  )
}
