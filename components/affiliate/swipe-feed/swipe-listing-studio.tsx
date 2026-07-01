"use client"

import { Loader2, Sparkles } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { useCallback, useEffect, useState } from "react"

import {
  ListingBuilderModal,
  type SerializedListing,
} from "@/components/affiliate/listing-builder-modal"
import type { SwipeFeedProduct } from "@/lib/affiliate-swipe-feed-types"

type CatalogProduct = {
  id: string
  name: string
  description?: string
  images: string[]
  basePriceCents: number
  commissionRate?: number
  supplierCommissionRateBps?: number | null
  colors?: string[]
  variants?: unknown
  hasVariants?: boolean
  productVariants?: Array<{
    color: string | null
    size: string | null
    stock: number
    customData?: unknown
  }>
}

type Props = {
  product: SwipeFeedProduct | null
  open: boolean
  suggestedMarkupRate: number
  listingContext?: "swipe" | "onboarding"
  onClose: () => void
  onPublished: (result: { listingId?: string; product: SwipeFeedProduct }) => void
}

export function SwipeListingStudio({
  product,
  open,
  suggestedMarkupRate,
  listingContext = "swipe",
  onClose,
  onPublished,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [catalogProduct, setCatalogProduct] = useState<CatalogProduct | null>(null)
  const [storeSlug, setStoreSlug] = useState<string | null>(null)
  const [published, setPublished] = useState(false)

  const load = useCallback(async (productId: string) => {
    setLoading(true)
    setLoadError(null)
    setCatalogProduct(null)
    try {
      const [detailRes, bootRes] = await Promise.all([
        fetch(`/api/affiliate/catalog-product/${encodeURIComponent(productId)}`, {
          credentials: "include",
          cache: "no-store",
        }),
        fetch("/api/affiliate/bootstrap", { credentials: "include", cache: "no-store" }),
      ])
      const detail = (await detailRes.json()) as { product?: CatalogProduct; error?: string }
      const boot = (await bootRes.json()) as { storeSlug?: string | null }

      if (!detailRes.ok || !detail.product) {
        throw new Error(detail.error ?? "Impossible de charger le produit")
      }

      setCatalogProduct(detail.product)
      setStoreSlug(typeof boot.storeSlug === "string" ? boot.storeSlug : null)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Chargement impossible")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open || !product) {
      setCatalogProduct(null)
      setLoadError(null)
      setPublished(false)
      return
    }
    void load(product.id)
  }, [open, product, load])

  const handleClose = () => {
    if (published) return
    onClose()
  }

  const handleSaved = (result?: { listingId?: string; published?: boolean }) => {
    if (!product) return
    setPublished(true)
    if (result?.published !== false) {
      onPublished({ listingId: result?.listingId, product })
    } else {
      onClose()
    }
  }

  return (
    <>
      <AnimatePresence>
        {open && loading ? (
          <motion.div
            key="swipe-studio-loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-zinc-950/75 backdrop-blur-md"
          >
            <div className="relative">
              <div className="absolute -inset-8 rounded-full bg-violet-600/25 blur-2xl" aria-hidden />
              <div className="relative flex flex-col items-center gap-4 rounded-3xl border border-white/10 bg-zinc-900/90 px-10 py-8 shadow-2xl">
                <Loader2 className="size-10 animate-spin text-violet-400" aria-hidden />
                <div className="text-center">
                  <p className="flex items-center justify-center gap-2 text-sm font-semibold text-white">
                    <Sparkles className="size-4 text-violet-400" aria-hidden />
                    Studio vitrine
                  </p>
                  <p className="mt-1 max-w-[220px] text-xs text-zinc-400">
                    Préparation marge, titre et SEO…
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {open && loadError && !loading ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/75 p-6 backdrop-blur-md">
          <div className="max-w-sm rounded-2xl border border-rose-500/30 bg-zinc-900 p-6 text-center shadow-xl">
            <p className="text-sm font-medium text-white">{loadError}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 rounded-xl bg-zinc-800 px-4 py-2 text-sm text-zinc-100 hover:bg-zinc-700"
            >
              Fermer
            </button>
          </div>
        </div>
      ) : null}

      <ListingBuilderModal
        open={open && !loading && !loadError && catalogProduct != null}
        product={catalogProduct}
        listing={null as SerializedListing | null}
        storeSlug={storeSlug}
        onClose={handleClose}
        onSaved={handleSaved}
        suggestedMarkupRate={suggestedMarkupRate}
        enableAutosave={false}
        context={listingContext}
      />
    </>
  )
}
