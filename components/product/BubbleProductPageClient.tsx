"use client"

import { motion, useScroll, useTransform } from "framer-motion"
import Link from "next/link"
import { useRef } from "react"

import { DeliveryBadge } from "@/components/logistics/DeliveryBadge"
import { BubbleProductCard, type BubbleProductCardProduct } from "@/components/product/BubbleProductCard"
import { MarginLockListCta } from "@/components/product/MarginLockListCta"
import { SupplierTrustBadge } from "@/components/logistics/SupplierTrustBadge"
import type { BubbleProductView } from "@/lib/social/bubble-product-types"

type Similar = { id: string; title: string; imageUrl: string | null; salePrice: number; marginEuro: number }

type Props = {
  product: BubbleProductView
  similar: Similar[]
  catalogSocialHref: string
}

export function BubbleProductPageClient({ product, similar, catalogSocialHref }: Props) {
  const cardProduct: BubbleProductCardProduct = {
    id: product.id,
    title: product.title,
    imageUrl: product.imageUrl,
    salePrice: product.salePrice,
    compareAtPrice: product.compareAtPrice,
    marginEuro: product.marginEuro,
    deliveryDays: product.deliveryDays,
    deliveryCountry: product.deliveryCountry,
    supplierTrustScore: product.supplierTrustScore,
    bubbleUrl: product.bubbleUrl,
  }

  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start start", "end end"] })
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "20%"])

  return (
    <div ref={containerRef} className="relative min-h-screen overflow-x-hidden bg-slate-950 text-white">
      <motion.div
        style={{ y: bgY }}
        className="pointer-events-none fixed inset-0 opacity-80"
        aria-hidden
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,#8b5cf6_0%,transparent_45%),radial-gradient(circle_at_80%_30%,#06b6d4_0%,transparent_40%),linear-gradient(180deg,#020617,#0f172a)]" />
      </motion.div>

      <div className="relative mx-auto max-w-lg px-4 pb-32 pt-12">
        <div className="mb-8 flex justify-center">
          <BubbleProductCard product={cardProduct} variant="bubble-card" showShareBar />
        </div>

        <StackBubble title="Prix & marge">
          <p className="text-3xl font-black">{product.salePrice.toFixed(2)}€</p>
          <p className="mt-1 text-emerald-300">+{product.marginEuro.toFixed(0)}€ sans stock</p>
          <MarginLockListCta
            productId={product.id}
            salePrice={product.salePrice}
            catalogHref={catalogSocialHref}
          />
        </StackBubble>

        <StackBubble title="Délais">
          <DeliveryBadge days={product.deliveryDays} country={product.deliveryCountry} variant="full" />
        </StackBubble>

        <StackBubble title="Fournisseur">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10 text-lg">
              {product.supplierName?.slice(0, 1) ?? "S"}
            </div>
            <div>
              <p className="font-semibold">{product.supplierName ?? "Fournisseur vérifié"}</p>
              <SupplierTrustBadge trustScore={product.supplierTrustScore} />
            </div>
          </div>
        </StackBubble>

        <StackBubble title="Preuves sociales">
          <p className="text-sm text-white/70">Avis acheteurs & créateurs — bientôt en bulles chat live.</p>
        </StackBubble>

        {similar.length > 0 ? (
          <section className="mt-10">
            <h2 className="mb-4 text-center text-sm font-semibold uppercase tracking-widest text-white/60">
              Orbit · similaires
            </h2>
            <div className="flex flex-wrap justify-center gap-4">
              {similar.map((s, i) => (
                <motion.div
                  key={s.id}
                  animate={{ y: [0, -6, 0] }}
                  transition={{ repeat: Infinity, duration: 3 + i * 0.4, ease: "easeInOut" }}
                >
                  <Link href={`/product/${s.id}/bubble`}>
                    <BubbleProductCard
                      product={{
                        id: s.id,
                        title: s.title,
                        imageUrl: s.imageUrl,
                        salePrice: s.salePrice,
                        marginEuro: s.marginEuro,
                        deliveryDays: product.deliveryDays,
                        deliveryCountry: product.deliveryCountry,
                        supplierTrustScore: product.supplierTrustScore,
                      }}
                      variant="bubble-mini"
                    />
                  </Link>
                </motion.div>
              ))}
            </div>
          </section>
        ) : null}

        <p className="mt-12 text-center text-xs text-white/40">
          <Link href={`/product/${product.id}?view=bubble`} className="underline">
            Lien canonique
          </Link>
          {" · "}
          <Link href={catalogSocialHref} className="underline">
            Rendre viral →
          </Link>
        </p>
      </div>
    </div>
  )
}

function StackBubble({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.section
      className="mb-5 rounded-3xl border border-white/15 bg-white/5 p-5 backdrop-blur-xl"
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-violet-300">{title}</h2>
      {children}
    </motion.section>
  )
}
