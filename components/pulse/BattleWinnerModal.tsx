"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { X } from "lucide-react"

import { BattleTimer } from "@/components/pulse/BattleTimer"
import type { BattlePayload } from "@/lib/pulse/battle-types"
import { cn } from "@/lib/utils"

type Props = {
  battle: BattlePayload
  onClose: () => void
}

function money(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
  })
}

/**
 * Full-screen winner celebration + flash CTA.
 */
export function BattleWinnerModal({ battle, onClose }: Props) {
  const winner =
    battle.winnerId === battle.productA.id ? battle.productA : battle.productB
  const pct =
    battle.winnerId === battle.productA.id ? battle.pctA : battle.pctB
  const flash = battle.flashDiscount > 0 ? battle.flashDiscount : 20
  const referenceCents =
    battle.priceReferenceCents != null && battle.priceReferenceCents > 0
      ? battle.priceReferenceCents
      : winner.priceCents
  const flashCents = Math.max(1, Math.floor(referenceCents * (1 - flash / 100)))
  const href = winner.affiliateProductId
    ? `/marketplace/${winner.affiliateProductId}?battleId=${battle.id}`
    : `/marketplace/${winner.id}?battleId=${battle.id}`

  const [burst, setBurst] = useState(true)
  useEffect(() => {
    const t = window.setTimeout(() => setBurst(false), 2800)
    return () => window.clearTimeout(t)
  }, [])

  const confetti = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        id: i,
        left: `${(i * 17) % 100}%`,
        delay: `${(i % 8) * 0.08}s`,
        color: ["#22c55e", "#a78bfa", "#f43f5e", "#fbbf24", "#38bdf8"][i % 5],
      })),
    []
  )

  async function shareTikTok() {
    const text = `🏆 ${winner.name} gagne le Pulse Battle Affisell avec ${pct}% des votes — −${flash}% pendant 5 min!`
    const url = typeof window !== "undefined" ? window.location.href : href
    try {
      if (navigator.share) {
        await navigator.share({ title: "Pulse Battle", text, url })
        return
      }
      await navigator.clipboard.writeText(`${text}\n${url}`)
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal
      data-testid="battle-winner-modal"
    >
      {burst
        ? confetti.map((c) => (
            <span
              key={c.id}
              className="pointer-events-none absolute top-0 h-2 w-2 animate-[battleConfetti_2.4s_ease-out_forwards] rounded-sm"
              style={{
                left: c.left,
                background: c.color,
                animationDelay: c.delay,
              }}
            />
          ))
        : null}

      <div className="relative w-full max-w-md rounded-3xl border border-white/15 bg-zinc-950 p-6 text-center text-white shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-2 text-white/50 hover:bg-white/10"
          aria-label="Fermer"
        >
          <X className="size-4" />
        </button>

        <p className="text-3xl" aria-hidden>
          🏆
        </p>
        <h2 className="mt-2 text-xl font-black leading-tight">
          {winner.name.toUpperCase()} GAGNE AVEC {pct}% DES VOTES
        </h2>
        <p className="mt-3 text-sm text-white/70">
          <span className="font-bold text-emerald-400">Prix Battle: {money(flashCents)}</span>
          <br />
          <span className="text-xs line-through opacity-60">
            Prix habituel Affisell: {money(referenceCents)}
          </span>
          <br />
          <span className="text-xs text-white/50">
            −{flash}% — flash jusqu&apos;à la fin du timer · Conforme DGCCRF
          </span>
        </p>

        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-white/50">
          Flash ends in
          <BattleTimer
            endsAt={battle.flashEndsAt}
            timeLeftMs={battle.flashTimeLeftMs}
            className="text-base text-red-400"
          />
        </div>

        <Link
          href={href}
          className={cn(
            "mt-6 flex h-12 w-full items-center justify-center rounded-full bg-red-500 text-sm font-black text-white animate-pulse"
          )}
        >
          ACHETER MAINTENANT −{flash}%
        </Link>
        <button
          type="button"
          onClick={() => void shareTikTok()}
          className="mt-2 flex h-11 w-full items-center justify-center rounded-full bg-white/10 text-sm text-white hover:bg-white/15"
        >
          Partager sur TikTok
        </button>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `@keyframes battleConfetti{0%{transform:translateY(-10vh) rotate(0deg);opacity:1}100%{transform:translateY(110vh) rotate(720deg);opacity:0}}`,
        }}
      />
    </div>
  )
}
