"use client"

import { useEffect, useRef } from "react"

import type { BattleVoteChatLine } from "@/lib/pulse/battle-types"
import { cn } from "@/lib/utils"

type Props = {
  lines: BattleVoteChatLine[]
  className?: string
}

/**
 * Read-only vote ticker chat (MVP — no WebSocket input).
 */
export function BattleChat({ lines, className }: Props) {
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [lines])

  return (
    <div
      className={cn("flex min-w-0 flex-1 flex-col px-3 py-2", className)}
      data-testid="battle-chat"
    >
      <div
        ref={scroller}
        className="max-h-14 flex-1 space-y-0.5 overflow-y-auto text-[11px] text-white/70"
      >
        {lines.length === 0 ? (
          <p className="text-white/40">Les votes apparaissent ici en live…</p>
        ) : (
          lines.map((l) => (
            <p key={l.id} className="truncate">
              {l.text}
            </p>
          ))
        )}
      </div>
      <input
        disabled
        placeholder="Chat bientôt — vote pour parler 🔥"
        className="mt-1 h-7 w-full cursor-not-allowed rounded-full border border-white/10 bg-white/5 px-3 text-[11px] text-white/40"
        aria-disabled
      />
    </div>
  )
}
