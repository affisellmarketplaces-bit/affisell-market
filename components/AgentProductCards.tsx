"use client"

import { motion } from "framer-motion"
import Link from "next/link"

import type { AgentProductCard } from "@/lib/agent-product-card-types"
import { useLiveStats } from "@/lib/live-stats"
import { WishlistHeart } from "@/components/wishlist-heart"

type Props = {
  products: AgentProductCard[]
  /** Optional heading above the grid (e.g. similar products). */
  sectionTitle?: string
  sectionSubtitle?: string
}

function AgentProductCardItem({ p }: { p: AgentProductCard }) {
  const live = useLiveStats(p.id)
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Link
      href={`/product/${p.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-zinc-900 transition-all hover:-translate-y-1 hover:border-violet-500/50 hover:shadow-2xl hover:shadow-violet-900/20"
    >
      <div className="relative aspect-square w-full bg-zinc-950">
        <div className="absolute left-3 top-3 z-20 rounded-full bg-red-500/90 px-2.5 py-1 text-xs font-medium text-white backdrop-blur animate-pulse">
          {live.viewersNow} regardent
        </div>
        <WishlistHeart productId={p.id} className="absolute right-3 top-3 z-20" />
        {p.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote Unsplash/supplier URLs; agent cards need plain img
          <img
            src={p.imageUrl}
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-zinc-500">
            No image
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="line-clamp-2 text-base font-semibold text-white">{p.name}</p>
        <p className="text-sm text-zinc-400">{p.brand}</p>
        <p className="mt-auto text-2xl font-bold text-white">
          {p.price.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
        </p>
        <div className="rounded-xl bg-white py-3 text-center text-sm font-medium text-black transition group-hover:bg-violet-600 group-hover:text-white">
          Voir le produit
        </div>
      </div>
    </Link>
    </motion.div>
  )
}

export function AgentProductCards({ products, sectionTitle, sectionSubtitle }: Props) {
  const list = products.slice(0, 3)
  if (list.length === 0) return null

  return (
    <div className="mt-3">
      {sectionTitle ? (
        <div className="mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-violet-300/90">{sectionTitle}</h3>
          {sectionSubtitle ? (
            <p className="mt-0.5 text-[11px] text-zinc-500">{sectionSubtitle}</p>
          ) : null}
        </div>
      ) : null}
      <motion.div
        className="grid grid-cols-1 gap-4 md:grid-cols-3"
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.05 } },
        }}
      >
      {list.map((p) => (
        <AgentProductCardItem key={p.id} p={p} />
      ))}
      </motion.div>
    </div>
  )
}
