"use client"

import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"

type Props = {
  endsAt: string
  className?: string
  urgentClassName?: string
}

function msLeft(endsAt: string): number {
  return Math.max(0, new Date(endsAt).getTime() - Date.now())
}

function formatParts(ms: number) {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return { h, m, s, urgent: ms > 0 && ms <= 3_600_000 }
}

export function AuctionCountdown({ endsAt, className, urgentClassName }: Props) {
  const [parts, setParts] = useState(() => formatParts(msLeft(endsAt)))

  useEffect(() => {
    const tick = () => setParts(formatParts(msLeft(endsAt)))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [endsAt])

  const pad = (n: number) => String(n).padStart(2, "0")

  return (
    <div
      className={cn(
        "font-mono text-2xl font-bold tabular-nums tracking-tight sm:text-3xl",
        parts.urgent ? urgentClassName : className
      )}
    >
      {pad(parts.h)}:{pad(parts.m)}:{pad(parts.s)}
    </div>
  )
}
