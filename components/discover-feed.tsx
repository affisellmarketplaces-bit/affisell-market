"use client"

import { motion } from "framer-motion"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { addGuestCartItem } from "@/lib/guest-cart"
import { useLiveStats } from "@/lib/live-stats"
import { WishlistHeart } from "@/components/wishlist-heart"

export type DiscoverItem = {
  productId: string
  listingId: string | null
  name: string
  priceCents: number
  mediaUrl: string | null
  isVideo: boolean
  boosted: boolean
}

function DiscoverCard({ item }: { item: DiscoverItem }) {
  const router = useRouter()
  const live = useLiveStats(item.productId)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [cartBusy, setCartBusy] = useState(false)
  const [checkoutBusy, setCheckoutBusy] = useState(false)

  useEffect(() => {
    if (!item.isVideo || !videoRef.current) return
    const el = videoRef.current
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.65)
        if (visible) void el.play().catch(() => {})
        else el.pause()
      },
      { threshold: [0.2, 0.65, 0.9] }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [item.isVideo])

  const price = useMemo(
    () =>
      (item.priceCents / 100).toLocaleString("fr-FR", {
        style: "currency",
        currency: "EUR",
      }),
    [item.priceCents]
  )

  async function oneTapAdd() {
    if (!item.listingId) return
    setCartBusy(true)
    try {
      const res = await fetch("/api/cart/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: item.listingId, qty: 1 }),
      })
      if (res.status === 401) {
        addGuestCartItem({
          productId: item.listingId,
          qty: 1,
          title: item.name,
          price: item.priceCents / 100,
          imageUrl: item.mediaUrl || "/placeholder.png",
        })
      }
    } finally {
      setCartBusy(false)
    }
  }

  async function oneTapCheckout() {
    if (!item.listingId) return
    setCheckoutBusy(true)
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: item.listingId,
          qty: 1,
          successPath: "/discover?success=true",
          cancelPath: "/discover",
        }),
      })
      if (res.status === 401) {
        router.push(`/login?callbackUrl=${encodeURIComponent("/discover")}`)
        return
      }
      const data = (await res.json()) as { url?: string }
      if (data.url) window.location.href = data.url
    } finally {
      setCheckoutBusy(false)
    }
  }

  return (
    <motion.article
      className="relative min-h-[100dvh] snap-start overflow-hidden bg-black text-white"
      initial={{ opacity: 0.85, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ amount: 0.45, once: false }}
      transition={{ duration: 0.25 }}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.05}
    >
      {item.mediaUrl ? (
        item.isVideo ? (
          <video
            ref={videoRef}
            src={item.mediaUrl}
            className="h-[100dvh] w-full object-cover"
            muted
            loop
            playsInline
            preload="metadata"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.mediaUrl} alt="" className="h-[100dvh] w-full object-cover" loading="lazy" />
        )
      ) : (
        <div className="flex h-[100dvh] w-full items-center justify-center bg-zinc-900 text-zinc-500">
          Pas de média
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-4">
        <WishlistHeart productId={item.productId} className="absolute right-4 top-[-38px] z-20" />
        {item.boosted ? (
          <span className="mb-2 inline-flex rounded-full bg-violet-500/90 px-2 py-1 text-[11px] font-semibold text-white">
            Recommandé pour vous
          </span>
        ) : null}
        <h2 className="line-clamp-2 text-lg font-semibold">{item.name}</h2>
        <p className="mt-1 text-2xl font-bold text-emerald-300">{price}</p>
        <p className="mt-1 text-sm text-zinc-100">{live.viewersNow} regardent</p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={!item.listingId || cartBusy}
            onClick={() => void oneTapAdd()}
            className="rounded-xl bg-white/90 px-4 py-2 text-sm font-semibold text-zinc-900 disabled:opacity-50"
          >
            {cartBusy ? "Ajout..." : "Ajouter"}
          </button>
          <button
            type="button"
            disabled={!item.listingId || checkoutBusy}
            onClick={() => void oneTapCheckout()}
            className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {checkoutBusy ? "..." : "Acheter"}
          </button>
        </div>
      </div>
    </motion.article>
  )
}

export function DiscoverFeed({ items }: { items: DiscoverItem[] }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const refs = useRef<Array<HTMLElement | null>>([])

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
      { threshold: [0.4, 0.6, 0.8] }
    )
    for (const n of nodes) io.observe(n)
    return () => io.disconnect()
  }, [items.length, activeIndex])

  return (
    <div className="relative h-[100dvh] bg-black">
      <div className="h-full snap-y snap-mandatory overflow-y-auto">
        {items.map((item, idx) => (
          <section
            key={item.productId}
            ref={(el) => {
              refs.current[idx] = el
            }}
            data-idx={idx}
          >
            <DiscoverCard item={item} />
          </section>
        ))}
      </div>
      <div className="pointer-events-none absolute right-2 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-1.5">
        {items.map((it, i) => (
          <span
            key={it.productId}
            className={i === activeIndex ? "h-5 w-1.5 rounded bg-white/95" : "h-1.5 w-1.5 rounded bg-white/45"}
          />
        ))}
      </div>
      <div className="pointer-events-none absolute right-3 top-4 z-20 rounded bg-black/45 px-2 py-1 text-xs text-white">
        {Math.min(activeIndex + 1, items.length)}/{items.length}
      </div>
    </div>
  )
}
