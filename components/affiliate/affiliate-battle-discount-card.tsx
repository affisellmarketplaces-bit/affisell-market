"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  AlertTriangle,
  Clock,
  Eye,
  Pause,
  Percent,
  Pencil,
  Play,
  Swords,
  Trash2,
  X,
} from "lucide-react"

import { BattleDiscountSlider } from "@/components/pulse/BattleDiscountSlider"
import { Button } from "@/components/ui/button"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { cn } from "@/lib/utils"

const DEFAULT_DISCOUNT = 20
const DURATION_PRESETS = [5, 10, 15, 30, 60] as const

type ListingPick = {
  listingId: string
  productId: string
  title: string
  imageUrl: string | null
  priceCents: number
}

type BattleSide = {
  id?: string
  name?: string
  image?: string | null
  priceCents?: number
  affiliateProductId?: string | null
}

type BattleState = {
  id: string
  status: "scheduled" | "live" | "ended"
  flashDiscount: number
  priceReferenceCents: number | null
  productA?: BattleSide
  productB?: BattleSide
  votesA?: number
  votesB?: number
  endedAt?: string | null
  startedAt?: string | null
}

type Phase = "select" | "preview" | "live" | "ended"

function ListingTile({
  item,
  side,
  selected,
  onToggle,
  disabled,
}: {
  item: ListingPick
  side: "A" | "B" | null
  selected: boolean
  onToggle: () => void
  disabled?: boolean
}) {
  const slotLabel = side === "A" ? "Produit 1" : side === "B" ? "Produit 2" : null
  const borderColor = selected
    ? side === "A"
      ? "border-amber-500 ring-2 ring-amber-400/35 bg-amber-50/90 dark:bg-amber-950/30 dark:border-amber-400"
      : "border-violet-500 ring-2 ring-violet-400/35 bg-violet-50/90 dark:bg-violet-950/30 dark:border-violet-400"
    : "border-zinc-200 bg-white hover:border-violet-300 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-violet-700"

  return (
    <label
      className={cn(
        "relative flex w-full cursor-pointer items-center gap-3 rounded-xl border p-2.5 text-left transition",
        disabled && "pointer-events-none opacity-50",
        borderColor
      )}
      data-testid={`battle-pick-${item.listingId}`}
    >
      <input
        type="checkbox"
        checked={selected}
        disabled={disabled}
        onChange={onToggle}
        className={cn(
          "size-4 shrink-0 rounded border-zinc-300 focus:ring-2 focus:ring-offset-1 dark:border-zinc-600",
          side === "A" ? "accent-amber-500 focus:ring-amber-400" : "accent-violet-600 focus:ring-violet-400"
        )}
        aria-label={
          selected && slotLabel
            ? `${item.title} — ${slotLabel}`
            : `Sélectionner ${item.title} pour le Battle`
        }
      />
      <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-zinc-200 dark:bg-zinc-800">
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt=""
            fill
            className="object-cover"
            sizes="44px"
            unoptimized
          />
        ) : (
          <span className="flex size-full items-center justify-center text-[10px] text-zinc-400">
            —
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-1 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
          {item.title}
        </span>
        <span className="mt-0.5 block text-[11px] text-zinc-500">
          {formatStoreCurrencyFromCents(item.priceCents)}
        </span>
      </span>
      {slotLabel ? (
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white",
            side === "A" ? "bg-amber-500" : "bg-violet-500"
          )}
        >
          {slotLabel}
        </span>
      ) : (
        <span
          className="size-4 shrink-0 rounded border border-dashed border-zinc-300 dark:border-zinc-600"
          aria-hidden
        />
      )}
    </label>
  )
}

function BattleSlotCard({
  label,
  pick,
  tone,
}: {
  label: string
  pick: ListingPick | null
  tone: "amber" | "violet"
}) {
  return (
    <div
      className={cn(
        "flex min-h-[4.25rem] flex-1 items-center gap-2.5 rounded-xl border px-3 py-2",
        tone === "amber"
          ? "border-amber-300/70 bg-amber-50/80 dark:border-amber-700/50 dark:bg-amber-950/25"
          : "border-violet-300/70 bg-violet-50/80 dark:border-violet-700/50 dark:bg-violet-950/25"
      )}
      data-testid={tone === "amber" ? "battle-slot-product-1" : "battle-slot-product-2"}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-black text-white",
          tone === "amber" ? "bg-amber-500" : "bg-violet-500"
        )}
      >
        {tone === "amber" ? "1" : "2"}
      </span>
      {pick ? (
        <>
          <span className="relative size-9 shrink-0 overflow-hidden rounded-md bg-zinc-200 dark:bg-zinc-800">
            {pick.imageUrl ? (
              <Image
                src={pick.imageUrl}
                alt=""
                fill
                className="object-cover"
                sizes="36px"
                unoptimized
              />
            ) : null}
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              {label}
            </span>
            <span className="line-clamp-1 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              {pick.title}
            </span>
          </span>
        </>
      ) : (
        <span className="text-xs text-zinc-500">
          <span className="block text-[10px] font-bold uppercase tracking-wider">{label}</span>
          Coche une fiche ci-dessous
        </span>
      )}
    </div>
  )
}

function BattlePreview({
  pickA,
  pickB,
  discount,
  durationMin,
  onLaunch,
  onBack,
  launching,
}: {
  pickA: ListingPick
  pickB: ListingPick
  discount: number
  durationMin: number
  onLaunch: () => void
  onBack: () => void
  launching: boolean
}) {
  const priceA = Math.max(1, Math.floor(pickA.priceCents * (1 - discount / 100)))
  const priceB = Math.max(1, Math.floor(pickB.priceCents * (1 - discount / 100)))

  return (
    <div className="space-y-4 rounded-2xl border border-violet-300/60 bg-gradient-to-br from-violet-50/80 via-white to-amber-50/60 p-5 dark:border-violet-800/50 dark:from-violet-950/40 dark:via-zinc-950 dark:to-amber-950/20">
      <div className="flex items-center gap-2">
        <Eye className="size-4 text-violet-600 dark:text-violet-300" aria-hidden />
        <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
          Prévisualisation du Battle
        </h3>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="rounded-xl border border-amber-200 bg-white p-3 text-center dark:border-amber-800/50 dark:bg-zinc-900">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-amber-600">
            Produit 1
          </p>
          {pickA.imageUrl ? (
            <div className="relative mx-auto mb-2 size-16 overflow-hidden rounded-lg">
              <Image
                src={pickA.imageUrl}
                alt=""
                fill
                className="object-cover"
                sizes="64px"
                unoptimized
              />
            </div>
          ) : null}
          <p className="line-clamp-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            {pickA.title}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500 line-through">
            {formatStoreCurrencyFromCents(pickA.priceCents)}
          </p>
          <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
            {formatStoreCurrencyFromCents(priceA)}
          </p>
        </div>

        <div className="flex flex-col items-center gap-1">
          <Swords className="size-5 text-violet-500" />
          <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
            −{discount}%
          </span>
          <span className="text-[10px] text-zinc-500">{durationMin}min</span>
        </div>

        <div className="rounded-xl border border-violet-200 bg-white p-3 text-center dark:border-violet-800/50 dark:bg-zinc-900">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-violet-600">
            Produit 2
          </p>
          {pickB.imageUrl ? (
            <div className="relative mx-auto mb-2 size-16 overflow-hidden rounded-lg">
              <Image
                src={pickB.imageUrl}
                alt=""
                fill
                className="object-cover"
                sizes="64px"
                unoptimized
              />
            </div>
          ) : null}
          <p className="line-clamp-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            {pickB.title}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500 line-through">
            {formatStoreCurrencyFromCents(pickB.priceCents)}
          </p>
          <p className="text-sm font-bold text-violet-600 dark:text-violet-400">
            {formatStoreCurrencyFromCents(priceB)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onLaunch} disabled={launching} className="gap-2">
          <Play className="size-3.5" />
          {launching ? "Lancement…" : "Lancer le Battle"}
        </Button>
        <Button variant="outline" onClick={onBack} disabled={launching} className="gap-2">
          <X className="size-3.5" />
          Modifier
        </Button>
      </div>
    </div>
  )
}

/**
 * Full Battle command panel — checkbox dual select (Produit 1 / Produit 2).
 */
export function AffiliateBattleDiscountCard() {
  const [battleState, setBattleState] = useState<BattleState | null>(null)
  const [flashDiscount, setFlashDiscount] = useState(DEFAULT_DISCOUNT)
  const [durationMinutes, setDurationMinutes] = useState(15)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const [listings, setListings] = useState<ListingPick[]>([])
  const [selectedA, setSelectedA] = useState<string | null>(null)
  const [selectedB, setSelectedB] = useState<string | null>(null)

  const [phase, setPhase] = useState<Phase>("select")

  useEffect(() => {
    if (typeof window === "undefined") return
    const focusBattle =
      window.location.hash === "#battle" ||
      new URLSearchParams(window.location.search).get("battle") === "1"
    if (!focusBattle) return
    document.getElementById("battle")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  const syncFromBattle = useCallback((b: BattleState, catalog: ListingPick[]) => {
    setBattleState(b)
    if (typeof b.flashDiscount === "number") setFlashDiscount(b.flashDiscount)

    const matchA = catalog.find(
      (l) => l.listingId === b.productA?.affiliateProductId || l.productId === b.productA?.id
    )
    const matchB = catalog.find(
      (l) => l.listingId === b.productB?.affiliateProductId || l.productId === b.productB?.id
    )
    if (matchA) setSelectedA(matchA.listingId)
    if (matchB) setSelectedB(matchB.listingId)

    if (b.status === "live") setPhase("live")
    else if (b.status === "ended") setPhase("ended")
    else setPhase("select")
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [listRes, battleRes] = await Promise.all([
          fetch("/api/store/my-listings", { credentials: "include", cache: "no-store" }),
          fetch("/api/pulse/battle/current", { cache: "no-store" }),
        ])

        let catalog: ListingPick[] = []
        if (listRes.ok) {
          const data = (await listRes.json().catch(() => null)) as { items?: ListingPick[] } | null
          catalog = (data?.items ?? []).filter(
            (i) => typeof i.listingId === "string" && typeof i.productId === "string"
          )
          if (!cancelled) setListings(catalog)
        }

        if (battleRes.ok) {
          const data = (await battleRes.json().catch(() => null)) as {
            battle?: BattleState | null
          } | null
          const b = data?.battle
          if (b?.id && (b.status === "live" || b.status === "scheduled") && !cancelled) {
            syncFromBattle(b, catalog)
          }
        }
      } catch {
        /* network */
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [syncFromBattle])

  function toggleProduct(listingId: string) {
    setError(null)
    setStatusMsg(null)
    if (selectedA === listingId) {
      setSelectedA(null)
      return
    }
    if (selectedB === listingId) {
      setSelectedB(null)
      return
    }
    if (!selectedA) {
      setSelectedA(listingId)
      return
    }
    if (!selectedB) {
      const next = listings.find((l) => l.listingId === listingId)
      const first = listings.find((l) => l.listingId === selectedA)
      if (next && first && next.productId === first.productId) {
        setError("Produit 1 et Produit 2 doivent être différents")
        return
      }
      setSelectedB(listingId)
      return
    }
    /** Already 2 checked — replace Produit 2. */
    const next = listings.find((l) => l.listingId === listingId)
    const first = listings.find((l) => l.listingId === selectedA)
    if (next && first && next.productId === first.productId) {
      setError("Produit 1 et Produit 2 doivent être différents")
      return
    }
    setSelectedB(listingId)
  }

  const pickA = useMemo(
    () => listings.find((l) => l.listingId === selectedA) ?? null,
    [listings, selectedA]
  )
  const pickB = useMemo(
    () => listings.find((l) => l.listingId === selectedB) ?? null,
    [listings, selectedB]
  )
  const canPreview = Boolean(pickA && pickB && pickA.productId !== pickB.productId)
  const checkedCount = (selectedA ? 1 : 0) + (selectedB ? 1 : 0)

  function goPreview() {
    if (!canPreview) {
      setError("Coche Produit 1 et Produit 2 (2 fiches différentes)")
      return
    }
    setError(null)
    setPhase("preview")
  }

  async function launchBattle() {
    if (!selectedA || !selectedB) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/pulse/battle/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingIdA: selectedA,
          listingIdB: selectedB,
          flashDiscount,
          durationMinutes,
          live: true,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        battleId?: string | null
        liveId?: string | null
        flashDiscount?: number
      }
      if (!res.ok) throw new Error(data.error || "Impossible de créer le Battle")
      const nextId = data.liveId || data.battleId || null
      if (!nextId) throw new Error("Aucun battle créé")

      setBattleState({
        id: nextId,
        status: "live",
        flashDiscount: data.flashDiscount ?? flashDiscount,
        priceReferenceCents: null,
        productA: pickA
          ? {
              id: pickA.productId,
              name: pickA.title,
              image: pickA.imageUrl,
              priceCents: pickA.priceCents,
            }
          : undefined,
        productB: pickB
          ? {
              id: pickB.productId,
              name: pickB.title,
              image: pickB.imageUrl,
              priceCents: pickB.priceCents,
            }
          : undefined,
      })
      setPhase("live")
      setStatusMsg("Battle lancé")
      console.log("[pulse-battle/hub]", {
        result: "launched",
        battleId: nextId,
        selectedA,
        selectedB,
        durationMinutes,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau")
    } finally {
      setBusy(false)
    }
  }

  async function endCurrentBattle() {
    if (!battleState?.id) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/pulse/battle/${encodeURIComponent(battleState.id)}/end`, {
        method: "POST",
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || "Impossible de terminer le Battle")
      setBattleState((prev) => (prev ? { ...prev, status: "ended" } : null))
      setPhase("ended")
      setStatusMsg("Battle terminé")
      console.log("[pulse-battle/hub]", { result: "ended", battleId: battleState.id })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau")
    } finally {
      setBusy(false)
    }
  }

  async function deleteBattle() {
    if (!battleState?.id) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/pulse/battle/${encodeURIComponent(battleState.id)}/end`, {
        method: "DELETE",
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || "Impossible de supprimer le Battle")
      setBattleState(null)
      setSelectedA(null)
      setSelectedB(null)
      setPhase("select")
      setConfirmDelete(false)
      setStatusMsg("Battle supprimé")
      console.log("[pulse-battle/hub]", { result: "deleted", battleId: battleState.id })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau")
    } finally {
      setBusy(false)
    }
  }

  function resetForNew() {
    setBattleState(null)
    setSelectedA(null)
    setSelectedB(null)
    setPhase("select")
    setError(null)
    setStatusMsg(null)
    setConfirmDelete(false)
  }

  const sellingForSlider = pickA?.priceCents || pickB?.priceCents || 3095

  return (
    <section id="battle" className="mx-auto max-w-3xl scroll-mt-24 space-y-3 px-4 pt-4 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-900 dark:bg-violet-950/50 dark:text-violet-100">
          <Swords className="size-3.5" aria-hidden />
          Pulse Battle · discount légal
        </div>
        {battleState?.id ? (
          <Link
            href={`/dashboard/pulse/${battleState.id}`}
            className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
          >
            Ouvrir détail Battle →
          </Link>
        ) : null}
      </div>

      {loading ? (
        <div className="h-52 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
      ) : phase === "preview" && pickA && pickB ? (
        <BattlePreview
          pickA={pickA}
          pickB={pickB}
          discount={flashDiscount}
          durationMin={durationMinutes}
          onLaunch={() => void launchBattle()}
          onBack={() => setPhase("select")}
          launching={busy}
        />
      ) : phase === "live" || phase === "ended" ? (
        <div className="space-y-3">
          {(pickA || pickB) && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <BattleSlotCard label="Produit 1" pick={pickA} tone="amber" />
              <BattleSlotCard label="Produit 2" pick={pickB} tone="violet" />
            </div>
          )}

          {battleState?.id ? (
            <BattleDiscountSlider
              key={`${battleState.id}-${sellingForSlider}`}
              battleId={battleState.id}
              initialFlashDiscount={flashDiscount}
              sellingPriceCents={sellingForSlider}
              priceReferenceCents={battleState.priceReferenceCents}
            />
          ) : null}

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
            {phase === "live" ? (
              <>
                <span className="mr-auto inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
                  En direct
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={busy}
                  onClick={() => {
                    setPhase("select")
                    setStatusMsg(null)
                  }}
                >
                  <Pencil className="size-3.5" />
                  Éditer
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-amber-700 hover:text-amber-900 dark:text-amber-300"
                  disabled={busy}
                  onClick={() => void endCurrentBattle()}
                >
                  <Pause className="size-3.5" />
                  Terminer
                </Button>
              </>
            ) : (
              <>
                <span className="mr-auto text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                  Terminé
                </span>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={resetForNew}>
                  <Play className="size-3.5" />
                  Nouveau Battle
                </Button>
              </>
            )}
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-rose-600 dark:text-rose-400">Confirmer ?</span>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={busy}
                  onClick={() => void deleteBattle()}
                >
                  Supprimer
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                  Annuler
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-rose-600 hover:text-rose-700 dark:text-rose-400"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="size-3.5" />
                Supprimer
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div
          className="space-y-4 rounded-2xl border border-violet-200/80 bg-white p-4 dark:border-violet-900/50 dark:bg-zinc-950 sm:p-5"
          data-testid="battle-product-picker"
        >
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-white">
              <Swords className="size-4 text-violet-600 dark:text-violet-300" />
              Produits du Battle
            </h2>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              Coche <strong>Produit 1</strong> puis <strong>Produit 2</strong> — le duel
              oppose ces deux fiches. Le gagnant (votes) reçoit le flash.
            </p>
          </div>

          {listings.length < 2 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-300">
              <AlertTriangle className="mb-1 inline size-4 text-amber-500" /> Il faut au
              moins 2 fiches listées pour créer un duel.
              <Link
                href="/dashboard/affiliate/hub?mode=swipe"
                className="mt-2 block font-semibold text-violet-700 hover:underline dark:text-violet-300"
              >
                Ouvrir le Swipe Feed →
              </Link>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2 sm:flex-row">
                <BattleSlotCard label="Produit 1" pick={pickA} tone="amber" />
                <span className="hidden items-center justify-center text-xs font-bold text-zinc-400 sm:flex">
                  VS
                </span>
                <BattleSlotCard label="Produit 2" pick={pickB} tone="violet" />
              </div>

              <p className="text-[11px] font-medium text-zinc-500">
                {checkedCount}/2 sélectionnés — coche exactement deux fiches
              </p>

              <ul className="grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2">
                {listings.map((item) => {
                  const isA = item.listingId === selectedA
                  const isB = item.listingId === selectedB
                  return (
                    <li key={item.listingId}>
                      <ListingTile
                        item={item}
                        side={isA ? "A" : isB ? "B" : null}
                        selected={isA || isB}
                        onToggle={() => toggleProduct(item.listingId)}
                      />
                    </li>
                  )
                })}
              </ul>
            </>
          )}

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200">
              <Clock className="size-3.5" aria-hidden />
              Durée du Battle
            </label>
            <div className="flex flex-wrap gap-1.5">
              {DURATION_PRESETS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDurationMinutes(m)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold transition",
                    durationMinutes === m
                      ? "border-violet-500 bg-violet-100 text-violet-900 dark:border-violet-400 dark:bg-violet-900/40 dark:text-violet-100"
                      : "border-zinc-200 text-zinc-600 hover:border-violet-300 dark:border-zinc-700 dark:text-zinc-300"
                  )}
                >
                  {m < 60 ? `${m}min` : `${m / 60}h`}
                </button>
              ))}
              <input
                type="number"
                min={5}
                max={1440}
                value={durationMinutes}
                onChange={(e) => {
                  const v = Math.max(5, Math.min(1440, Number(e.target.value) || 15))
                  setDurationMinutes(v)
                }}
                className="w-20 rounded-full border border-zinc-200 bg-white px-3 py-1 text-center text-xs tabular-nums dark:border-zinc-700 dark:bg-zinc-900"
                aria-label="Durée en minutes"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200">
              <Percent className="size-3.5" aria-hidden />
              Flash discount ({flashDiscount}%)
            </label>
            <input
              type="range"
              min={5}
              max={50}
              step={1}
              value={flashDiscount}
              onChange={(e) => setFlashDiscount(Math.round(Number(e.target.value)))}
              className="h-2 w-full cursor-pointer accent-violet-600"
            />
            <div className="flex justify-between text-[10px] text-zinc-500">
              <span>5%</span>
              <span className="font-bold text-violet-600 dark:text-violet-400">
                −{flashDiscount}%
              </span>
              <span>50%</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button disabled={!canPreview || busy} onClick={goPreview} className="gap-2">
              <Eye className="size-3.5" />
              Prévisualiser
            </Button>
            <Button
              variant="outline"
              disabled={!canPreview || busy}
              onClick={() => void launchBattle()}
              className="gap-2"
            >
              <Play className="size-3.5" />
              Valider le Battle
            </Button>
          </div>
        </div>
      )}

      {statusMsg ? (
        <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{statusMsg}</p>
      ) : null}
      {error ? (
        <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>
      ) : null}
    </section>
  )
}
