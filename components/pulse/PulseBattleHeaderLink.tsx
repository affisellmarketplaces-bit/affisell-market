"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"

/**
 * Compact Battle LIVE chip for Pulse immersive header (not global header).
 */
export function PulseBattleHeaderLink({ className }: { className?: string }) {
  const [live, setLive] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetch("/api/pulse/battle/current", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return
        const data = (await res.json()) as { battle?: { status?: string } }
        if (!cancelled) setLive(data.battle?.status === "live")
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Link
      href="/battles"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/40 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white/90",
        className
      )}
      data-testid="pulse-battle-header-link"
    >
      Battle
      <span className="relative flex h-1.5 w-1.5">
        <span
          className={cn(
            "absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75",
            live && "animate-ping"
          )}
        />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
      </span>
    </Link>
  )
}
