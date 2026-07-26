"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"

type Props = {
  className?: string
}

/**
 * Top banner linking to /pulse/battle — shows LIVE when a battle is live.
 */
export function PulseBattleBanner({ className }: Props) {
  const [live, setLive] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetch("/api/pulse/battle/current", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return
        const data = (await res.json()) as { battle?: { status?: string } }
        if (!cancelled) setLive(data.battle?.status === "live")
      })
      .catch(() => {
        /* never crash pulse */
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Link
      href="/pulse/battle"
      className={cn(
        "relative z-50 flex items-center justify-center gap-2 border-b border-white/10 bg-gradient-to-r from-red-600 via-fuchsia-600 to-violet-600 px-3 py-2 text-center text-[11px] font-bold text-white sm:text-xs",
        className
      )}
      data-testid="pulse-battle-banner"
    >
      {live ? (
        <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
      ) : (
        <span aria-hidden>🔥</span>
      )}
      {live
        ? "BATTLE LIVE — VOTE ET GAGNE −20% →"
        : "BATTLE LIVE À 18H — VOTE ET GAGNE −20% →"}
    </Link>
  )
}
