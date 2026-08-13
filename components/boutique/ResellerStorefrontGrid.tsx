"use client"

import Image from "next/image"
import { ArrowRight, Eye } from "lucide-react"
import { useRouter } from "next/navigation"

import { ResellerBoutiqueLayout } from "@/components/boutique/ResellerBoutiqueLayout"
import type { ResellerBoutiqueThemeProps } from "@/lib/boutique/reseller-boutique-theme-shared"
import type { ResellerStorefrontListProduct } from "@/lib/boutique/reseller-storefront-shared"

type ResellerStorefrontGridProps = {
  storeSlug: string
  storeLabel: string
  theme: ResellerBoutiqueThemeProps
  products: ResellerStorefrontListProduct[]
  count: number
}

export function ResellerStorefrontGrid({
  storeSlug,
  storeLabel,
  theme,
  products,
  count,
}: ResellerStorefrontGridProps) {
  const router = useRouter()

  return (
    <ResellerBoutiqueLayout
      storeSlug={storeSlug}
      storeLabel={storeLabel}
      theme={theme}
      productCount={count}
      hero={
        <div className="space-y-3">
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-5xl">
            Boutique{" "}
            <span style={{ color: "var(--boutique-hero-accent)" }}>{storeLabel}</span>
          </h2>
          <p className="max-w-xl text-sm opacity-80">
            Sélection curator — checkout 1-clic propulsé par Affisell.
          </p>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <article
            key={product.id}
            className="group flex h-full flex-col overflow-hidden rounded-3xl border shadow-sm backdrop-blur-sm transition hover:shadow-lg"
            style={{
              backgroundColor: "var(--boutique-card-bg)",
              borderColor: "var(--boutique-card-border)",
            }}
          >
            <div
              className="relative aspect-square overflow-hidden border-b"
              style={{
                background: "var(--boutique-card-image-bg)",
                borderColor: "var(--boutique-card-border)",
              }}
            >
              <Image
                src={product.image}
                alt={product.title}
                fill
                className="object-contain p-4 transition duration-500 group-hover:scale-[1.02]"
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                unoptimized={product.image.startsWith("http") || product.image.startsWith("/uploads")}
              />
              {product.isOutOfStock ? (
                <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700 shadow-sm">
                  Out of stock
                </span>
              ) : null}
            </div>

            <div className="flex flex-1 flex-col p-4">
              <h2
                className="line-clamp-2 min-h-[2.75rem] text-base font-semibold leading-snug"
                style={{ color: "var(--boutique-card-title)" }}
              >
                {product.title}
              </h2>
              <p
                className="mt-2 bg-clip-text text-lg font-bold tabular-nums text-transparent"
                style={{ backgroundImage: "var(--boutique-price-gradient)" }}
              >
                {product.priceLabel}
              </p>

              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/boutique/${encodeURIComponent(storeSlug)}?productId=${encodeURIComponent(product.id)}`
                  )
                }
                className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition hover:opacity-95"
                style={{
                  backgroundImage: "var(--boutique-button-gradient)",
                  boxShadow: "var(--boutique-button-shadow)",
                }}
              >
                <Eye className="h-4 w-4" aria-hidden />
                Voir le produit
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
              </button>
            </div>
          </article>
        ))}
      </div>
    </ResellerBoutiqueLayout>
  )
}
