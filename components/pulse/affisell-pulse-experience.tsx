"use client"

import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowLeft,
  Flame,
  MessageCircle,
  Share2,
  ShoppingBag,
  Sparkles,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { ProductPriceOffer } from "@/components/product/product-price-offer"
import { ProductSalesBadge } from "@/components/product/product-sales-badge"
import { PulseHeaderCartLink } from "@/components/pulse/pulse-header-cart-link"
import { PulseProductMediaStage } from "@/components/pulse/pulse-product-media-stage"
import { WishlistHeart } from "@/components/wishlist-heart"
import { addToBuyerCart } from "@/lib/cart-add-client"
import { buyNowWithoutLogin } from "@/lib/guest-buy-now-client"
import { formatStoreCount, formatStoreCurrencyFromCents } from "@/lib/market-config"
import { affisellBrand } from "@/lib/affisell-brand"
import { discoverSwipeHref } from "@/lib/discover-swipe-url"
import type { PulseFeedItem } from "@/lib/pulse-feed-types"
import { cn } from "@/lib/utils"

type Props = {
  items: PulseFeedItem[]
  viewerLoggedIn?: boolean
}

function PulseProgress({ active, total }: { active: number; total: number }) {
  return (
    <div className="flex gap-1 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]" aria-hidden>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-0.5 flex-1 overflow-hidden rounded-full bg-white/20 transition-all duration-300",
            i === active ? "opacity-100" : "opacity-50"
          )}
        >
          <div
            className={cn(
              "h-full rounded-full bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 transition-all duration-500",
              i < active ? "w-full" : i === active ? "w-1/2 animate-pulse" : "w-0"
            )}
          />
        </div>
      ))}
    </div>
  )
}

function PulseClip({
  item,
  active,
  muted,
  onView,
}: {
  item: PulseFeedItem
  active: boolean
  muted: boolean
  onView: () => void
}) {
  const viewed = useRef(false)

  useEffect(() => {
    if (!active || viewed.current) return
    const t = window.setTimeout(() => {
      viewed.current = true
      onView()
    }, 1200)
    return () => window.clearTimeout(t)
  }, [active, onView])

  return (
    <div className="absolute inset-0">
      {item.mediaUrl ? (
        <PulseProductMediaStage
          item={item}
          active={active}
          muted={muted}
          className="absolute inset-0"
        />
      ) : (
        <div className="flex h-full items-center justify-center bg-zinc-950 text-zinc-500">—</div>
      )}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/82"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-40 mix-blend-soft-light"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(34,211,238,0.35), transparent 55%), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(192,38,211,0.25), transparent 50%)",
        }}
        aria-hidden
      />
    </div>
  )
}

function PulseCard({
  item,
  active,
  muted,
  viewerLoggedIn,
  onToggleMute,
}: {
  item: PulseFeedItem
  active: boolean
  muted: boolean
  viewerLoggedIn: boolean
  onToggleMute: () => void
}) {
  const t = useTranslations("pulse")
  const router = useRouter()
  const [likes, setLikes] = useState(item.likes)
  const [likeBurst, setLikeBurst] = useState(false)
  const [cartBusy, setCartBusy] = useState(false)
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [following, setFollowing] = useState(false)
  const lastTap = useRef(0)

  const recordView = useCallback(() => {
    void fetch("/api/pulse/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: item.source,
        id: item.source === "community" ? item.id : undefined,
        productId: item.productId || undefined,
      }),
    })
  }, [item])

  async function pulseLike() {
    if (item.source !== "community") {
      setLikes((n) => n + 1)
      setLikeBurst(true)
      window.setTimeout(() => setLikeBurst(false), 600)
      return
    }
    const res = await fetch("/api/pulse/like", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: item.source, id: item.id }),
    })
    if (res.ok) {
      const j = (await res.json()) as { likes?: number }
      if (typeof j.likes === "number") setLikes(j.likes)
      else setLikes((n) => n + 1)
      setLikeBurst(true)
      window.setTimeout(() => setLikeBurst(false), 600)
    }
  }

  function onDoubleTap() {
    const now = Date.now()
    if (now - lastTap.current < 320) void pulseLike()
    lastTap.current = now
  }

  async function toggleFollow() {
    if (!item.storeSlug) return
    if (!viewerLoggedIn) {
      router.push(`/login?callbackUrl=${encodeURIComponent("/discover")}`)
      return
    }
    const res = await fetch("/api/follow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ storeSlug: item.storeSlug }),
    })
    if (res.ok) {
      const j = (await res.json()) as { following?: boolean }
      if (typeof j.following === "boolean") setFollowing(j.following)
    }
  }

  async function shareClip() {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}${item.href}`
        : item.href
    try {
      if (navigator.share) await navigator.share({ title: item.title, url })
      else await navigator.clipboard.writeText(url)
    } catch {
      try {
        await navigator.clipboard.writeText(url)
      } catch {
        /* ignore */
      }
    }
  }

  async function oneTapAdd() {
    if (!item.listingId) return
    setCartBusy(true)
    try {
      await addToBuyerCart({
        productId: item.listingId,
        qty: 1,
        title: item.title,
        price: item.priceCents / 100,
        imageUrl: item.mediaUrl,
      })
    } finally {
      setCartBusy(false)
    }
  }

  async function oneTapCheckout() {
    if (!item.listingId) return
    setCheckoutBusy(true)
    try {
      await buyNowWithoutLogin(
        {
          productId: item.listingId,
          qty: 1,
          successPath: "/discover?success=true",
          cancelPath: "/discover",
        },
        {
          productId: item.listingId,
          title: item.title,
          price: item.priceCents / 100,
          imageUrl: item.mediaUrl,
        }
      )
    } finally {
      setCheckoutBusy(false)
    }
  }

  const compareEur = item.compareAtCents != null ? item.compareAtCents / 100 : null
  const priceEur = item.priceCents / 100

  return (
    <article
      className="relative h-[100dvh] w-full snap-start snap-always overflow-hidden bg-black"
      onClick={onDoubleTap}
    >
      <PulseClip item={item} active={active} muted={muted} onView={recordView} />

      <AnimatePresence>
        {likeBurst ? (
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1.2, opacity: 1 }}
            exit={{ scale: 1.6, opacity: 0 }}
            className="pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2"
          >
            <Sparkles className="size-20 text-rose-400 drop-shadow-[0_0_24px_rgba(244,63,94,0.8)]" />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Right action rail */}
      <div className="absolute bottom-28 right-3 z-30 flex flex-col items-center gap-4">
        {item.storeSlug ? (
          <Link
            href={`/shops/${encodeURIComponent(item.storeSlug)}`}
            className="relative block"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="absolute -inset-0.5 rounded-full bg-gradient-to-tr from-cyan-400 via-violet-500 to-fuchsia-500 opacity-90 blur-sm" />
            <span className="relative block size-12 overflow-hidden rounded-full border-2 border-white/90 bg-zinc-800 shadow-lg">
              {item.storeAvatarUrl ? (
                <Image src={item.storeAvatarUrl} alt="" width={48} height={48} className="size-full object-cover" unoptimized />
              ) : (
                <span className="flex size-full items-center justify-center text-xs font-bold text-white">
                  {(item.storeName || "?").slice(0, 1)}
                </span>
              )}
            </span>
          </Link>
        ) : null}
        <button
          type="button"
          className="flex flex-col items-center gap-0.5 text-white"
          onClick={(e) => {
            e.stopPropagation()
            void pulseLike()
          }}
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-white/10 backdrop-blur-md ring-1 ring-white/20">
            <Flame className={cn("size-5", likeBurst && "text-rose-400")} />
          </span>
          <span className="text-[10px] font-semibold tabular-nums">{formatStoreCount(likes)}</span>
        </button>
        <button
          type="button"
          className="flex flex-col items-center gap-0.5 text-white"
          onClick={(e) => {
            e.stopPropagation()
            void shareClip()
          }}
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-white/10 backdrop-blur-md ring-1 ring-white/20">
            <Share2 className="size-5" />
          </span>
          <span className="text-[10px] font-medium">{t("share")}</span>
        </button>
        {item.productId ? (
          <div onClick={(e) => e.stopPropagation()}>
            <WishlistHeart productId={item.productId} className="!relative !right-0 !top-0" />
          </div>
        ) : null}
        {item.isVideo ? (
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md ring-1 ring-white/20"
            onClick={(e) => {
              e.stopPropagation()
              onToggleMute()
            }}
            aria-label={muted ? t("unmute") : t("mute")}
          >
            {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
          </button>
        ) : null}
        {item.storeSlug ? (
          <button
            type="button"
            className="flex flex-col items-center gap-0.5 text-white"
            onClick={(e) => {
              e.stopPropagation()
              void toggleFollow()
            }}
          >
            <span
              className={cn(
                "flex size-11 items-center justify-center rounded-full backdrop-blur-md ring-1 ring-white/20",
                following ? "bg-violet-500/80" : "bg-white/10"
              )}
            >
              <MessageCircle className="size-5" />
            </span>
            <span className="text-[10px] font-medium">{following ? t("following") : t("follow")}</span>
          </button>
        ) : null}
      </div>

      {/* Bottom commerce panel */}
      <div
        className="absolute inset-x-0 bottom-0 z-20 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={cn(affisellBrand.epoxyPanel, "p-4")}>
          <div className="flex flex-wrap items-center gap-2">
            {item.boosted ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/40 bg-cyan-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-100">
                <Zap className="size-3" aria-hidden />
                {t("forYou")}
              </span>
            ) : null}
            {item.soldCount > 0 ? (
              <ProductSalesBadge count={item.soldCount} variant="inline" className="!bg-white/10 !text-white !ring-white/20" />
            ) : null}
          </div>
          <Link href={item.href} className="mt-2 block">
            <h2 className="line-clamp-2 text-base font-semibold leading-snug text-white">{item.title}</h2>
          </Link>
          {item.caption ? (
            <p className="mt-1 line-clamp-2 text-xs text-white/75">{item.caption}</p>
          ) : null}
          {item.priceCents > 0 ? (
            <div className="mt-3 [&_span]:!text-white [&_p]:!text-white/70">
              <ProductPriceOffer
                price={priceEur}
                compareAt={compareEur}
                layout="compact"
              />
            </div>
          ) : null}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={!item.listingId || cartBusy}
              onClick={() => void oneTapAdd()}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 py-2.5 text-sm font-semibold text-white backdrop-blur disabled:opacity-40"
            >
              <ShoppingBag className="size-4" />
              {cartBusy ? "…" : t("add")}
            </button>
            <button
              type="button"
              disabled={!item.listingId || checkoutBusy}
              onClick={() => void oneTapCheckout()}
              className={cn(
                affisellBrand.epoxyCta,
                "relative flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 py-2.5 text-sm font-bold text-white disabled:opacity-40"
              )}
            >
              <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_25%,rgba(255,255,255,0.25)_50%,transparent_75%)]" aria-hidden />
              {checkoutBusy ? "…" : t("buyNow")}
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

export function AffisellPulseExperience({ items, viewerLoggedIn = false }: Props) {
  const t = useTranslations("pulse")
  const [activeIndex, setActiveIndex] = useState(0)
  const [muted, setMuted] = useState(true)
  const refs = useRef<Array<HTMLElement | null>>([])

  const safeItems = useMemo(() => items.filter((i) => i.mediaUrl), [items])

  useEffect(() => {
    const nodes = refs.current.filter(Boolean) as HTMLElement[]
    if (nodes.length === 0) return
    const io = new IntersectionObserver(
      (entries) => {
        let bestIdx = activeIndex
        let bestRatio = 0
        for (const e of entries) {
          const idx = Number((e.target as HTMLElement).dataset.idx ?? -1)
          if (idx < 0) continue
          if (e.intersectionRatio > bestRatio) {
            bestRatio = e.intersectionRatio
            bestIdx = idx
          }
        }
        if (bestIdx !== activeIndex) setActiveIndex(bestIdx)
      },
      { threshold: [0.55, 0.75, 0.9] }
    )
    for (const n of nodes) io.observe(n)
    return () => io.disconnect()
  }, [safeItems.length, activeIndex])

  if (safeItems.length === 0) {
    return (
      <div
        data-testid="affisell-pulse"
        className={cn(
          affisellBrand.epoxyPage,
          "relative flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center"
        )}
      >
        <div className={affisellBrand.epoxyCanvas} aria-hidden />
        <Sparkles className="mb-4 size-12 text-violet-400" />
        <p className="text-lg font-semibold">{t("emptyTitle")}</p>
        <p className="mt-2 max-w-sm text-sm text-zinc-400">{t("emptyBody")}</p>
        <Link
          href="/marketplace"
          className="mt-6 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-2.5 text-sm font-semibold"
        >
          {t("browseCatalog")}
        </Link>
      </div>
    )
  }

  return (
    <div
      data-testid="affisell-pulse"
      className={cn(affisellBrand.epoxyPage, "fixed inset-0 z-[140] flex flex-col")}
    >
      <div className={affisellBrand.epoxyCanvas} aria-hidden />
      <div className="pointer-events-none absolute inset-0 z-0 opacity-30">
        <div className="absolute -left-1/4 top-0 h-[50vh] w-[70vw] rounded-full bg-violet-600/40 blur-[100px]" />
        <div className="absolute -right-1/4 bottom-0 h-[40vh] w-[60vw] rounded-full bg-cyan-500/30 blur-[90px]" />
      </div>

      <header className="relative z-40 shrink-0">
        <PulseProgress active={activeIndex} total={safeItems.length} />
        <div className="flex items-center justify-between px-3 pb-2 pt-2">
          <Link
            href="/#explorer"
            className={cn(affisellBrand.epoxyChip, "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-white/90")}
          >
            <ArrowLeft className="size-4" />
            {t("exit")}
          </Link>
          <div className="flex items-center gap-2">
            <span className={affisellBrand.brandWordmark}>{t("brand")}</span>
            <span className={cn(affisellBrand.epoxyChip, "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-white/90")}>
              {t("beta")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <PulseHeaderCartLink />
            <Link
              href={discoverSwipeHref()}
              className={cn(affisellBrand.epoxyChip, "rounded-full px-2 py-1 text-[10px] font-semibold text-cyan-200")}
            >
              {t("swipeMode")}
            </Link>
            <span className="tabular-nums text-xs text-white/70">
              {activeIndex + 1}/{safeItems.length}
            </span>
          </div>
        </div>
      </header>

      <div className="relative z-10 min-h-0 flex-1 snap-y snap-mandatory overflow-y-auto overscroll-y-contain scroll-smooth">
        {safeItems.map((item, idx) => (
          <section
            key={`${item.source}-${item.id}`}
            ref={(el) => {
              refs.current[idx] = el
            }}
            data-idx={idx}
          >
            <PulseCard
              item={item}
              active={idx === activeIndex}
              muted={muted}
              viewerLoggedIn={viewerLoggedIn}
              onToggleMute={() => setMuted((m) => !m)}
            />
          </section>
        ))}
      </div>

      <p className="relative z-40 shrink-0 px-4 py-2 text-center text-[10px] text-white/40">
        {t("hint")}
      </p>
    </div>
  )
}
