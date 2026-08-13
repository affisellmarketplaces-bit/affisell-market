"use client"

import Image from "next/image"
import { Eye, Sparkles } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import type { ResellerBoutiqueThemeProps } from "@/lib/boutique/reseller-boutique-theme-shared"
import type { ResellerStorefrontListProduct } from "@/lib/boutique/reseller-storefront-shared"

type ResellerStorefrontGridProps = {
  storeSlug: string
  storeLabel: string
  tagline?: string | null
  theme: ResellerBoutiqueThemeProps
  products: ResellerStorefrontListProduct[]
  count: number
}

function storeInitial(label: string): string {
  const trimmed = label.trim()
  return trimmed ? trimmed.charAt(0).toUpperCase() : "B"
}

export function ResellerStorefrontGrid({
  storeSlug,
  storeLabel,
  tagline,
  theme: _theme,
  products,
  count,
}: ResellerStorefrontGridProps) {
  const router = useRouter()

  const handleAiPersonalize = () => {
    toast.message("AI Personalization coming soon — will call /api/ai/store-avatar")
  }

  return (
    <>
      <header className="relative mb-10 md:mb-12">
        <button
          type="button"
          onClick={handleAiPersonalize}
          className="mb-6 inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-black px-5 py-2.5 text-sm font-medium text-white shadow-[0_0_20px_rgba(109,40,217,0.3)] transition-all duration-300 hover:scale-[1.02] hover:bg-white hover:text-black hover:shadow-[0_0_30px_rgba(109,40,217,0.5)] md:absolute md:right-0 md:top-0 md:mb-0 md:w-auto"
        >
          <Sparkles className="size-4 shrink-0" aria-hidden />
          Personalize my store with AI ✨
        </button>

        <div className="flex items-start gap-4 pr-0 md:pr-[17rem]">
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-teal-500 text-sm font-bold text-white shadow-lg ring-2 ring-white/20"
            aria-hidden
          >
            {storeInitial(storeLabel)}
          </span>
          <div className="min-w-0 space-y-3">
            <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              Boutique{" "}
              <span className="bg-gradient-to-r from-white to-violet-200 bg-clip-text text-transparent">
                {storeLabel}
              </span>
            </h1>
            {tagline?.trim() ? (
              <p className="max-w-xl text-sm leading-relaxed text-white/60">{tagline.trim()}</p>
            ) : null}
            <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm text-white/70">
              {count} produit{count > 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
        {products.map((product) => (
          <article
            key={product.id}
            className="group rounded-3xl border border-white/50 bg-white/[0.95] p-3 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-xl transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_16px_48px_rgba(0,0,0,0.2)]"
          >
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-gray-50">
              <Image
                src={product.image}
                alt={product.title}
                fill
                className="object-contain p-4 transition duration-500 group-hover:scale-[1.02]"
                sizes="(max-width: 768px) 100vw, 50vw"
                unoptimized={product.image.startsWith("http") || product.image.startsWith("/uploads")}
              />
              {product.isOutOfStock ? (
                <span className="absolute left-3 top-3 rounded-full bg-red-500 px-2.5 py-1 text-xs font-bold text-white shadow-lg">
                  Out of stock
                </span>
              ) : null}
            </div>

            <div className="p-4 pt-4">
              <h2 className="text-lg font-bold leading-tight text-gray-900">{product.title}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-gray-500">
                Checkout sécurisé · Livraison Affisell
              </p>
              <p className="mt-3 text-2xl font-extrabold tracking-tight text-gray-900">
                {product.priceLabel}
              </p>

              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/boutique/${encodeURIComponent(storeSlug)}?productId=${encodeURIComponent(product.id)}`
                  )
                }
                className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-teal-500 text-sm font-medium text-white transition-all duration-300 hover:from-violet-700 hover:to-teal-600 hover:shadow-[0_4px_20px_rgba(109,40,217,0.4)] group-hover:scale-[1.01]"
              >
                <Eye className="size-4" aria-hidden />
                Voir le produit
              </button>
            </div>
          </article>
        ))}
      </div>

      <footer className="mt-12 border-t border-white/10 pt-6 text-center text-xs text-white/40">
        Boutique {storeSlug} · Propulsé par Affisell
      </footer>
    </>
  )
}
