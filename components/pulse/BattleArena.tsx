"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"

import { BattleChat } from "@/components/pulse/BattleChat"
import { BattleProductCard } from "@/components/pulse/BattleProductCard"
import { BattleTimer } from "@/components/pulse/BattleTimer"
import { BattleWinnerModal } from "@/components/pulse/BattleWinnerModal"
import type { BattlePayload } from "@/lib/pulse/battle-types"
import { cn } from "@/lib/utils"

/**
 * Full-screen Netflix-style Pulse Battle arena.
 */
export function BattleArena() {
  const [battle, setBattle] = useState<BattlePayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [voting, setVoting] = useState(false)
  const [showWinner, setShowWinner] = useState(false)
  const endedHandled = useRef<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/pulse/battle/current", {
        cache: "no-store",
        credentials: "include",
      })
      const data = (await res.json()) as {
        ok?: boolean
        battle?: BattlePayload
        error?: string
        message?: string
      }
      if (!res.ok || !data.battle) {
        setError(data.message || data.error || "unavailable")
        return
      }
      setBattle(data.battle)
      setError(null)
      if (data.battle.status === "ended" && data.battle.winnerId) {
        if (endedHandled.current !== data.battle.id) {
          endedHandled.current = data.battle.id
          setShowWinner(true)
        }
      }
    } catch {
      setError("network")
    }
  }, [])

  useEffect(() => {
    void refresh()
    const id = window.setInterval(() => void refresh(), 2000)
    return () => window.clearInterval(id)
  }, [refresh])

  async function vote(productId: string) {
    if (!battle || battle.status !== "live" || battle.alreadyVotedProductId || voting) return
    setVoting(true)
    try {
      // Ephemeral demo battles: optimistic local vote only
      if (battle.id.startsWith("demo_")) {
        setBattle((prev) => {
          if (!prev) return prev
          const votesA = productId === prev.productA.id ? prev.votesA + 1 : prev.votesA
          const votesB = productId === prev.productB.id ? prev.votesB + 1 : prev.votesB
          const total = votesA + votesB
          return {
            ...prev,
            votesA,
            votesB,
            totalVoters: prev.totalVoters + 1,
            alreadyVotedProductId: productId,
            pctA: total > 0 ? Math.round((votesA / total) * 100) : 50,
            pctB: total > 0 ? 100 - Math.round((votesA / total) * 100) : 50,
          }
        })
        return
      }

      const res = await fetch("/api/pulse/battle/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ battleId: battle.id, productId }),
      })
      const data = (await res.json()) as {
        votesA?: number
        votesB?: number
        totalVoters?: number
        error?: string
      }
      if (res.ok) {
        setBattle((prev) =>
          prev
            ? {
                ...prev,
                votesA: data.votesA ?? prev.votesA,
                votesB: data.votesB ?? prev.votesB,
                totalVoters: data.totalVoters ?? prev.totalVoters,
                alreadyVotedProductId: productId,
                pctA:
                  (data.votesA ?? 0) + (data.votesB ?? 0) > 0
                    ? Math.round(
                        ((data.votesA ?? 0) /
                          ((data.votesA ?? 0) + (data.votesB ?? 0))) *
                          100
                      )
                    : 50,
                pctB:
                  (data.votesA ?? 0) + (data.votesB ?? 0) > 0
                    ? 100 -
                      Math.round(
                        ((data.votesA ?? 0) /
                          ((data.votesA ?? 0) + (data.votesB ?? 0))) *
                          100
                      )
                    : 50,
              }
            : prev
        )
        void refresh()
      }
    } finally {
      setVoting(false)
    }
  }

  if (error && !battle) {
    return (
      <div className="fixed inset-0 z-[210] flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-black px-6 text-center text-white">
        <p className="text-lg font-semibold">Battle indisponible</p>
        <p className="max-w-sm text-sm text-white/50">
          {error === "NO_BATTLE_PRODUCTS"
            ? "Pas assez de produits listés pour lancer un duel."
            : "On prépare l’arène — réessaie dans quelques secondes."}
        </p>
        <button
          type="button"
          onClick={() => {
            setError(null)
            void refresh()
          }}
          className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black"
        >
          Réessayer
        </button>
        <Link href="/discover" className="text-xs text-white/50 hover:text-white">
          Retour Pulse
        </Link>
      </div>
    )
  }

  if (!battle) {
    return (
      <div className="fixed inset-0 z-[210] flex min-h-[100dvh] items-center justify-center bg-black text-sm text-white/50">
        Chargement du battle…
      </div>
    )
  }

  const votedId = battle.alreadyVotedProductId
  const productADetailsHref = battle.productA.affiliateProductId
    ? `/marketplace/${battle.productA.affiliateProductId}?battleId=${battle.id}`
    : null
  const productBDetailsHref = battle.productB.affiliateProductId
    ? `/marketplace/${battle.productB.affiliateProductId}?battleId=${battle.id}`
    : null
  const winnerHref =
    battle.winnerId === battle.productA.id
      ? productADetailsHref
      : productBDetailsHref

  return (
    <div
      className="fixed inset-0 z-[210] flex h-[100dvh] w-screen flex-col overflow-hidden bg-black"
      data-testid="battle-arena"
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
          <span className="text-sm font-black tracking-widest text-white">
            PULSE BATTLE · {battle.status === "live" ? "LIVE" : battle.status.toUpperCase()}
          </span>
          <span className="hidden text-xs text-white/50 sm:inline">
            {battle.totalVoters} votant{battle.totalVoters === 1 ? "" : "s"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {battle.status === "live" ? (
            <BattleTimer
              endsAt={battle.endedAt}
              timeLeftMs={battle.timeLeftMs}
              onEnd={() => void refresh()}
            />
          ) : battle.status === "scheduled" ? (
            <span className="text-xs text-white/50">Bientôt 18h</span>
          ) : (
            <BattleTimer
              endsAt={battle.flashEndsAt}
              timeLeftMs={battle.flashTimeLeftMs}
              className="text-red-400"
            />
          )}
          <Link href="/discover" className="text-xs text-white/50 hover:text-white">
            Pulse
          </Link>
        </div>
      </div>

      <div className="relative grid min-h-0 flex-1 grid-cols-1 sm:grid-cols-2">
        <BattleProductCard
          product={battle.productA}
          votes={battle.votesA}
          pct={battle.pctA}
          side="A"
          isWinner={battle.winnerId === battle.productA.id}
          voted={votedId === battle.productA.id}
          disabled={battle.status !== "live" || Boolean(votedId) || voting}
          detailsHref={productADetailsHref}
          onVote={() => void vote(battle.productA.id)}
        />
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-xl font-black text-black shadow-2xl sm:h-20 sm:w-20 sm:text-2xl">
          VS
        </div>
        <BattleProductCard
          product={battle.productB}
          votes={battle.votesB}
          pct={battle.pctB}
          side="B"
          isWinner={battle.winnerId === battle.productB.id}
          voted={votedId === battle.productB.id}
          disabled={battle.status !== "live" || Boolean(votedId) || voting}
          detailsHref={productBDetailsHref}
          onVote={() => void vote(battle.productB.id)}
        />
      </div>

      <div className="flex h-auto min-h-20 shrink-0 flex-col border-t border-white/10 sm:flex-row">
        <BattleChat lines={battle.recentVotes} />
        <div className="w-full border-t border-white/10 p-3 sm:w-72 sm:border-l sm:border-t-0 sm:shrink-0">
          {battle.status === "live" ? (
            <p className="flex h-12 items-center justify-center rounded-full bg-white/10 text-center text-xs font-bold text-white">
              Vote pour ton winner → −{battle.flashDiscount}% s&apos;il gagne
            </p>
          ) : null}
          {battle.status === "ended" && winnerHref ? (
            <Link
              href={winnerHref}
              className={cn(
                "flex h-12 w-full animate-pulse items-center justify-center rounded-full bg-red-500 text-sm font-black text-white"
              )}
            >
              🔥 −{battle.flashDiscount}% → ACHETER
            </Link>
          ) : null}
          {battle.status === "scheduled" ? (
            <p className="flex h-12 items-center justify-center text-center text-xs text-white/50">
              Battle programmé — reviens à 18h Paris
            </p>
          ) : null}
        </div>
      </div>

      {showWinner && battle.status === "ended" && battle.winnerId ? (
        <BattleWinnerModal battle={battle} onClose={() => setShowWinner(false)} />
      ) : null}
    </div>
  )
}
