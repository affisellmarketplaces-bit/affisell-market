"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"

type Props = {
  className?: string
}

/**
 * Top banner linking to /battles hub — shows LIVE when a battle is live.
 */
export function PulseBattleBanner({ className }: Props) {
  const [live, setLive] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetch("/api/pulse/battle/list", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return
        const data = (await res.json()) as { live?: { status?: string } | null }
        if (!cancelled) setLive(data.live?.status === "live")
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
      href="/battles"
      className={cn(
        "relative z-50 flex items-center justify-center gap-1.5 border-b border-white/10 bg-gradient-to-r from-red-600 via-fuchsia-600 to-violet-600 px-2 py-1.5 text-center text-[10px] font-bold leading-tight text-white sm:gap-2 sm:px-3 sm:py-2 sm:text-[11px] md:text-xs",
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
      <span className="min-w-0 truncate">
        {live
          ? "HUB BATTLES — VOTE ET GAGNE LE FLASH →"
          : "HUB DES BATTLES — DÉCOUVRE LES DUELS →"}
      </span>
    </Link>
  )
}
