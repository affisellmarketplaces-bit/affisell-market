"use client"

import { useCallback, useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Check, Package, Swords } from "lucide-react"

import { BattleDiscountSlider } from "@/components/pulse/BattleDiscountSlider"
import { Button } from "@/components/ui/button"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { cn } from "@/lib/utils"

const DEFAULT_DISCOUNT = 20

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

/**
 * Hub card: pick reseller listing → Battle contender + legal flash %.
 */
export function AffiliateBattleDiscountCard() {
  const [battleId, setBattleId] = useState<string | null>(null)
  const [flashDiscount, setFlashDiscount] = useState(DEFAULT_DISCOUNT)
  const [sellingPriceCents, setSellingPriceCents] = useState(0)
  const [priceReferenceCents, setPriceReferenceCents] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [bootstrapping, setBootstrapping] = useState(false)
  const [savingContender, setSavingContender] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)

  const [listings, setListings] = useState<ListingPick[]>([])
  const [listingsLoading, setListingsLoading] = useState(true)
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    const focusBattle =
      window.location.hash === "#battle" ||
      new URLSearchParams(window.location.search).get("battle") === "1"
    if (!focusBattle) return
    const el = document.getElementById("battle")
    el?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  const syncFromBattle = useCallback(
    (
      b: {
        id?: string
        flashDiscount?: number
        priceReferenceCents?: number | null
        productA?: BattleSide
        productB?: BattleSide
      },
      catalog: ListingPick[]
    ) => {
      if (!b.id) return
      setBattleId(b.id)
      if (typeof b.flashDiscount === "number") setFlashDiscount(b.flashDiscount)
      if (typeof b.priceReferenceCents === "number" && b.priceReferenceCents > 0) {
        setPriceReferenceCents(b.priceReferenceCents)
      }

      const owned =
        catalog.find((l) => l.listingId === b.productA?.affiliateProductId) ||
        catalog.find((l) => l.listingId === b.productB?.affiliateProductId) ||
        catalog.find((l) => l.productId === b.productA?.id) ||
        catalog.find((l) => l.productId === b.productB?.id)

      if (owned) {
        setSelectedListingId(owned.listingId)
        setSellingPriceCents(owned.priceCents)
        return
      }

      const sell = b.productA?.priceCents ?? b.productB?.priceCents
      if (typeof sell === "number" && sell > 0) setSellingPriceCents(sell)
    },
    []
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setListingsLoading(true)
      try {
        const [listRes, battleRes] = await Promise.all([
          fetch("/api/store/my-listings", { credentials: "include", cache: "no-store" }),
          fetch("/api/pulse/battle/current", { cache: "no-store" }),
        ])

        let catalog: ListingPick[] = []
        if (listRes.ok) {
          const listData = (await listRes.json().catch(() => null)) as {
            items?: ListingPick[]
          } | null
          catalog = (listData?.items ?? []).filter(
            (i) => typeof i.listingId === "string" && typeof i.productId === "string"
          )
          if (!cancelled) setListings(catalog)
        }

        if (battleRes.ok) {
          const data = (await battleRes.json().catch(() => null)) as {
            battle?: {
              id?: string
              status?: string
              flashDiscount?: number
              priceReferenceCents?: number | null
              productA?: BattleSide
              productB?: BattleSide
            } | null
          } | null
          const b = data?.battle
          if (
            b?.id &&
            (b.status === "live" || b.status === "scheduled") &&
            !cancelled
          ) {
            syncFromBattle(b, catalog)
          } else if (!cancelled && catalog[0]) {
            setSelectedListingId(catalog[0].listingId)
            setSellingPriceCents(catalog[0].priceCents)
          }
        } else if (!cancelled && catalog[0]) {
          setSelectedListingId(catalog[0].listingId)
          setSellingPriceCents(catalog[0].priceCents)
        }
      } catch {
        /* ignore network */
      } finally {
        if (!cancelled) {
          setLoading(false)
          setListingsLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [syncFromBattle])

  function selectListing(listingId: string) {
    const row = listings.find((l) => l.listingId === listingId)
    if (!row) return
    setSelectedListingId(listingId)
    setSellingPriceCents(row.priceCents)
    setError(null)
    setStatusMsg(null)
  }

  async function applyContender(listingId: string, targetBattleId: string) {
    const res = await fetch(
      `/api/pulse/battle/${encodeURIComponent(targetBattleId)}/contender`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId }),
      }
    )
    const data = (await res.json().catch(() => ({}))) as {
      error?: string
      contender?: {
        sellingPriceCents?: number
        priceReferenceCents?: number | null
        flashDiscount?: number
        listingId?: string
      }
    }
    if (!res.ok) throw new Error(data.error || "Impossible d’ancrer le produit")
    if (typeof data.contender?.sellingPriceCents === "number") {
      setSellingPriceCents(data.contender.sellingPriceCents)
    }
    if (
      typeof data.contender?.priceReferenceCents === "number" &&
      data.contender.priceReferenceCents > 0
    ) {
      setPriceReferenceCents(data.contender.priceReferenceCents)
    }
    if (typeof data.contender?.flashDiscount === "number") {
      setFlashDiscount(data.contender.flashDiscount)
    }
    if (data.contender?.listingId) setSelectedListingId(data.contender.listingId)
    return data
  }

  async function saveSelectedProduct() {
    if (!selectedListingId) {
      setError("Choisis un produit de ta vitrine")
      return
    }
    setSavingContender(true)
    setError(null)
    setStatusMsg(null)
    try {
      if (battleId) {
        await applyContender(selectedListingId, battleId)
        setStatusMsg("Produit Battle mis à jour")
        console.log("[pulse-battle/hub]", {
          result: "contender_saved",
          battleId,
          listingId: selectedListingId,
        })
        return
      }
      await bootstrapBattle(selectedListingId)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau")
    } finally {
      setSavingContender(false)
    }
  }

  async function bootstrapBattle(listingId?: string | null) {
    const lid = listingId ?? selectedListingId
    if (!lid) {
      setError("Choisis un produit avant de créer le Battle")
      return
    }
    setBootstrapping(true)
    setError(null)
    try {
      const res = await fetch("/api/pulse/battle/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flashDiscount: DEFAULT_DISCOUNT,
          listingId: lid,
          live: true,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        battleId?: string | null
        liveId?: string | null
        flashDiscount?: number
      }
      if (!res.ok) throw new Error(data.error || "Impossible de créer le battle")
      const nextId = data.liveId || data.battleId || null
      if (!nextId) throw new Error("Aucun battle disponible")
      setBattleId(nextId)
      if (typeof data.flashDiscount === "number") setFlashDiscount(data.flashDiscount)
      await applyContender(lid, nextId).catch(() => {
        /* create may already have applied */
      })
      setStatusMsg("Battle prêt avec ton produit")
      console.log("[pulse-battle/hub]", {
        result: "bootstrapped",
        battleId: nextId,
        listingId: lid,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau")
    } finally {
      setBootstrapping(false)
    }
  }

  const selected = listings.find((l) => l.listingId === selectedListingId) ?? null
  const priceForSlider =
    sellingPriceCents > 0
      ? sellingPriceCents
      : selected?.priceCents && selected.priceCents > 0
        ? selected.priceCents
        : 3095

  return (
    <section
      id="battle"
      className="mx-auto max-w-3xl scroll-mt-24 space-y-3 px-4 pt-4 sm:px-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-900 dark:bg-violet-950/50 dark:text-violet-100">
          <Swords className="size-3.5" aria-hidden />
          Pulse Battle · discount légal
        </div>
        {battleId ? (
          <Link
            href={`/dashboard/pulse/${battleId}`}
            className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
          >
            Ouvrir détail Battle →
          </Link>
        ) : null}
      </div>

      {loading || listingsLoading ? (
        <div className="h-48 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
      ) : (
        <div className="space-y-3">
          <div
            className="rounded-2xl border border-violet-200/80 bg-white p-4 dark:border-violet-900/50 dark:bg-zinc-950 sm:p-5"
            data-testid="battle-product-picker"
          >
            <div className="flex items-start gap-2">
              <Package className="mt-0.5 size-4 shrink-0 text-violet-600 dark:text-violet-300" />
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                  Ton produit en Battle
                </h2>
                <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                  Choisis la fiche de ta vitrine qui combat — le % flash s’applique sur ce
                  prix.
                </p>
              </div>
            </div>

            {listings.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-300">
                Aucune fiche listée. Publie un produit depuis le Swipe Feed, puis reviens
                ici.
                <Link
                  href="/dashboard/affiliate/hub?mode=swipe"
                  className="mt-2 block font-semibold text-violet-700 hover:underline dark:text-violet-300"
                >
                  Ouvrir le Swipe Feed →
                </Link>
              </div>
            ) : (
              <ul className="mt-4 grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2">
                {listings.map((item) => {
                  const active = item.listingId === selectedListingId
                  return (
                    <li key={item.listingId}>
                      <button
                        type="button"
                        onClick={() => selectListing(item.listingId)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition",
                          active
                            ? "border-violet-500 bg-violet-50 ring-2 ring-violet-400/40 dark:border-violet-400 dark:bg-violet-950/40"
                            : "border-zinc-200 bg-zinc-50/80 hover:border-violet-300 dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-violet-700"
                        )}
                        aria-pressed={active}
                      >
                        <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-zinc-200 dark:bg-zinc-800">
                          {item.imageUrl ? (
                            <Image
                              src={item.imageUrl}
                              alt=""
                              fill
                              className="object-cover"
                              sizes="48px"
                              unoptimized
                            />
                          ) : (
                            <span className="flex size-full items-center justify-center text-[10px] text-zinc-400">
                              —
                            </span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                            {item.title}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-zinc-500">
                            {formatStoreCurrencyFromCents(item.priceCents)}
                          </span>
                        </span>
                        {active ? (
                          <Check
                            className="size-4 shrink-0 text-violet-600 dark:text-violet-300"
                            aria-hidden
                          />
                        ) : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={
                  !selectedListingId ||
                  savingContender ||
                  bootstrapping ||
                  listings.length === 0
                }
                onClick={() => void saveSelectedProduct()}
              >
                {savingContender || bootstrapping
                  ? "Enregistrement…"
                  : battleId
                    ? "Utiliser ce produit"
                    : "Créer mon Battle avec ce produit"}
              </Button>
            </div>

            {statusMsg ? (
              <p className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                {statusMsg}
              </p>
            ) : null}
            {error ? (
              <p className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400">
                {error}
              </p>
            ) : null}
          </div>

          {battleId ? (
            <BattleDiscountSlider
              key={`${battleId}-${selectedListingId ?? "none"}-${priceForSlider}`}
              battleId={battleId}
              initialFlashDiscount={flashDiscount}
              sellingPriceCents={priceForSlider}
              priceReferenceCents={priceReferenceCents}
            />
          ) : null}
        </div>
      )}
    </section>
  )
}
