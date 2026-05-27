"use client"

import { AnimatePresence, motion } from "framer-motion"
import { ArrowLeft, Crown, Gem, ShoppingBag, Sparkles } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useMemo, useState } from "react"

import { WishlistHeart } from "@/components/wishlist-heart"
import { affisellBrand } from "@/lib/affisell-brand"
import { addToBuyerCart } from "@/lib/cart-add-client"
import { LUXURY_TIER_COLLECTION, LUXURY_TIER_LUXE } from "@/lib/luxury-constants"
import type { LuxuryAtelierPayload, LuxuryPiecePublic } from "@/lib/luxury-types"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { cn } from "@/lib/utils"

type Props = {
  initial: LuxuryAtelierPayload
  initialCollectionSlug?: string | null
  /** Supplier / affiliate: onboarding copy for empty vitrine. */
  showMerchantHint?: boolean
}

export function LuxuryAtelierExperience({
  initial,
  initialCollectionSlug,
  showMerchantHint = false,
}: Props) {
  const t = useTranslations("luxe")
  const [payload, setPayload] = useState(initial)
  const [collectionSlug, setCollectionSlug] = useState<string | null>(initialCollectionSlug ?? null)
  const [focusId, setFocusId] = useState(initial.featuredListingId ?? initial.pieces[0]?.listingId ?? "")

  const filteredPieces = useMemo(() => {
    if (!collectionSlug) return payload.pieces
    const col = payload.collections.find((c) => c.slug === collectionSlug)
    if (!col) return payload.pieces
    return payload.pieces.filter((p) => p.collectionId === col.id)
  }, [payload.pieces, payload.collections, collectionSlug])

  const focusPiece = useMemo(
    () => filteredPieces.find((p) => p.listingId === focusId) ?? filteredPieces[0] ?? null,
    [filteredPieces, focusId]
  )

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/luxe", { cache: "no-store" })
      if (!res.ok) return
      const data = (await res.json()) as LuxuryAtelierPayload
      setPayload(data)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => void refresh(), 12_000)
    return () => window.clearInterval(id)
  }, [refresh])

  const tickerLines = useMemo(() => {
    const lines = payload.pieces.slice(0, 8).map((p) => {
      const badge = p.tier === LUXURY_TIER_LUXE ? t("badgeLuxe") : p.collectionName ?? t("badgeCollection")
      return `${badge} · ${p.title.slice(0, 42)}${p.title.length > 42 ? "…" : ""}`
    })
    if (lines.length === 0) return [t("tickerEmpty")]
    return [...lines, ...lines]
  }, [payload.pieces, t])

  async function addToCart(piece: LuxuryPiecePublic) {
    const result = await addToBuyerCart({
      productId: piece.listingId,
      qty: 1,
      title: piece.title,
      price: piece.priceCents / 100,
      imageUrl: piece.imageUrl,
      sellerName: piece.storeName ?? undefined,
    })
    if (result.ok) {
      console.log("[luxe-atelier]", { listingId: piece.listingId, result: "cart" })
    }
  }

  return (
    <div className="affisell-luxe-atelier" data-testid="luxe-atelier">
      <div className="affisell-luxe-shimmer pointer-events-none absolute inset-0" aria-hidden />

      <header
        className={cn(
          affisellBrand.epoxySurface,
          "relative z-20 mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6"
        )}
      >
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-amber-100/80 hover:text-amber-50"
        >
          <ArrowLeft className="size-4" />
          {t("back")}
        </Link>
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-amber-200/90">
            {t("eyebrow")}
          </p>
          <h1 className="bg-gradient-to-r from-amber-100 via-yellow-200 to-amber-400 bg-clip-text text-lg font-semibold tracking-wide text-transparent sm:text-xl">
            {t("title")}
          </h1>
        </div>
        <Crown className="size-7 text-amber-300/90" aria-hidden />
      </header>

      <div className="relative z-10 mx-auto max-w-6xl px-4 pb-24 pt-4 sm:px-6 sm:pb-12">
        <div className="mb-5 overflow-hidden rounded-2xl border border-amber-500/20 bg-black/50 py-2 backdrop-blur-md">
          <div className="affisell-luxe-ticker flex whitespace-nowrap text-xs font-medium text-amber-100/65">
            {tickerLines.map((line, i) => (
              <span key={`${line}-${i}`} className="mx-8 inline-flex items-center gap-2">
                <Gem className="size-3 text-amber-300/80" aria-hidden />
                {line}
              </span>
            ))}
          </div>
        </div>

        {payload.collections.length > 0 ? (
          <div className="mb-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCollectionSlug(null)}
              className={cn(
                affisellBrand.epoxyChip,
                "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                !collectionSlug
                  ? "bg-amber-500/30 text-amber-50 ring-1 ring-amber-300/50"
                  : "text-amber-100/70 hover:text-amber-50"
              )}
            >
              {t("allCollections")}
            </button>
            {payload.collections.map((col) => (
              <button
                key={col.id}
                type="button"
                onClick={() => setCollectionSlug(col.slug)}
                className={cn(
                  affisellBrand.epoxyChip,
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                  collectionSlug === col.slug
                    ? "bg-amber-500/30 text-amber-50 ring-1 ring-amber-300/50"
                    : "text-amber-100/70 hover:text-amber-50"
                )}
              >
                {col.name}
                <span className="ml-1 tabular-nums text-amber-200/60">({col.pieceCount})</span>
              </button>
            ))}
          </div>
        ) : null}

        {focusPiece ? (
          <motion.article
            layout
            className={cn(
              affisellBrand.epoxySurface,
              "affisell-luxe-hero relative overflow-hidden rounded-[1.75rem] p-4 sm:p-6"
            )}
          >
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-violet-900/20" />

            <div className="relative grid gap-6 lg:grid-cols-[1fr_1.05fr]">
              <div className="relative mx-auto aspect-[4/5] w-full max-w-md overflow-hidden rounded-2xl bg-zinc-950/80 ring-1 ring-amber-400/25">
                <Image
                  src={focusPiece.imageUrl}
                  alt=""
                  fill
                  className="object-contain p-4"
                  sizes="(max-width: 768px) 100vw, 420px"
                  unoptimized={
                    focusPiece.imageUrl.startsWith("http") || focusPiece.imageUrl.startsWith("data:")
                  }
                  priority
                />
                <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider",
                      focusPiece.tier === LUXURY_TIER_LUXE
                        ? "bg-amber-500/95 text-black"
                        : "bg-violet-900/80 text-amber-100 ring-1 ring-amber-400/40"
                    )}
                  >
                    {focusPiece.tier === LUXURY_TIER_LUXE
                      ? t("badgeLuxe")
                      : focusPiece.collectionName ?? t("badgeCollection")}
                  </span>
                  <span className="rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold tabular-nums text-amber-100">
                    {t("prestige", { score: focusPiece.prestigeScore })}
                  </span>
                </div>
                <div className="absolute right-3 top-3">
                  <WishlistHeart productId={focusPiece.productId} />
                </div>
              </div>

              <div className="flex flex-col justify-between gap-4">
                <div>
                  {focusPiece.storeName ? (
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-200/70">
                      {focusPiece.storeName}
                    </p>
                  ) : null}
                  <h2 className="mt-2 font-serif text-2xl font-medium leading-snug text-amber-50 sm:text-3xl">
                    {focusPiece.title}
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-amber-100/55">{t("subtitle")}</p>
                </div>

                <div className="flex flex-wrap items-end gap-3">
                  <p className="text-3xl font-light tabular-nums text-amber-50">
                    {formatStoreCurrencyFromCents(focusPiece.priceCents)}
                  </p>
                  {focusPiece.compareAtCents != null ? (
                    <p className="pb-1 text-sm text-amber-200/45 line-through">
                      {formatStoreCurrencyFromCents(focusPiece.compareAtCents)}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void addToCart(focusPiece)}
                    className={cn(
                      affisellBrand.epoxyCta,
                      "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 px-4 py-2.5 text-sm font-bold text-black shadow-lg shadow-amber-900/40"
                    )}
                  >
                    <ShoppingBag className="size-4" />
                    {t("acquire")}
                  </button>
                  <Link
                    href={focusPiece.href}
                    className={cn(
                      affisellBrand.epoxyChip,
                      "inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-medium text-amber-50"
                    )}
                  >
                    <Sparkles className="size-4 text-amber-300" />
                    {t("viewPiece")}
                  </Link>
                </div>
              </div>
            </div>
          </motion.article>
        ) : (
          <div
            className={cn(
              affisellBrand.epoxySurface,
              "flex flex-col items-center justify-center rounded-[1.75rem] border border-amber-500/15 px-6 py-20 text-center"
            )}
          >
            <Crown className="mb-4 size-12 text-amber-400/40" aria-hidden />
            <p className="max-w-md text-base leading-relaxed text-amber-100/70">
              {showMerchantHint ? t("empty") : t("emptyPublic")}
            </p>
          </div>
        )}

        {filteredPieces.length > 1 ? (
          <section className="mt-10">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-[0.24em] text-amber-200/50">
              {t("gallery")}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence mode="popLayout">
                {filteredPieces
                  .filter((p) => p.listingId !== focusPiece?.listingId)
                  .map((piece) => (
                    <motion.button
                      key={piece.listingId}
                      type="button"
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setFocusId(piece.listingId)}
                      className={cn(
                        affisellBrand.epoxySurface,
                        "group relative overflow-hidden rounded-2xl p-3 text-left transition hover:ring-1 hover:ring-amber-400/35",
                        focusId === piece.listingId && "ring-2 ring-amber-400/60"
                      )}
                    >
                      <div className="relative aspect-square overflow-hidden rounded-xl bg-zinc-950">
                        <Image
                          src={piece.imageUrl}
                          alt=""
                          fill
                          className="object-cover transition duration-500 group-hover:scale-105"
                          sizes="(max-width: 640px) 50vw, 280px"
                          unoptimized={piece.imageUrl.startsWith("http")}
                        />
                        <span className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-200">
                          {piece.tier === LUXURY_TIER_LUXE
                            ? t("badgeLuxe")
                            : piece.collectionName ?? t("badgeCollection")}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm font-medium text-amber-50">{piece.title}</p>
                      <p className="mt-1 text-sm font-light tabular-nums text-amber-200">
                        {formatStoreCurrencyFromCents(piece.priceCents)}
                      </p>
                    </motion.button>
                  ))}
              </AnimatePresence>
            </div>
          </section>
        ) : null}

        {showMerchantHint ? (
          <p className="mt-10 text-center text-[11px] text-amber-100/40">{t("curationNote")}</p>
        ) : null}
      </div>
    </div>
  )
}
