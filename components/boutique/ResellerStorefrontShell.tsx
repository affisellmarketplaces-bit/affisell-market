"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Loader2, Package, ShieldCheck, Sparkles, Truck } from "lucide-react"
import { useCallback, useState, type ReactNode } from "react"
import { toast } from "sonner"

import { ResellerBoutiqueLayout } from "@/components/boutique/ResellerBoutiqueLayout"
import { ResellerBoutiqueThemeVars } from "@/components/boutique/reseller-boutique-theme-vars"
import type { ResellerBoutiqueThemeProps } from "@/lib/boutique/reseller-boutique-theme-shared"
import type { ResellerStorefrontProduct } from "@/lib/boutique/load-reseller-storefront.server"
import {
  DEFAULT_STOREFRONT_THEME_ID,
  getStorefrontThemeById,
  type StorefrontTheme,
} from "@/lib/boutique/storefront-themes"

type ResellerStorefrontShellProps = {
  storeSlug: string
  storeLabel: string
  theme: ResellerBoutiqueThemeProps
  product: ResellerStorefrontProduct | null
  requestedListingId: string | null
  header?: ReactNode
  visualThemeId?: StorefrontTheme
}

type CreateResellerOrderResponse = {
  success?: boolean
  checkoutUrl?: string
  orderId?: string
  marginCents?: number
  error?: string
}

const ORDER_ERROR_HINTS: Record<string, string> = {
  out_of_stock: "Ce produit est en rupture de stock.",
  affiliate_commission_required: "Commission fournisseur manquante — contactez le support.",
  stripe_minimum_not_met: "Montant trop faible pour Stripe (min. 0,50 €).",
  delivery_destination_unavailable: "Livraison indisponible pour ce produit.",
  stripe_unavailable: "Paiement temporairement indisponible.",
  stripe_session_failed: "Session Stripe impossible — réessayez.",
  listing_not_found: "Produit introuvable ou non listé.",
}

export function ResellerStorefrontShell({
  storeSlug,
  storeLabel,
  theme,
  product,
  requestedListingId,
  header,
  visualThemeId = DEFAULT_STOREFRONT_THEME_ID,
}: ResellerStorefrontShellProps) {
  const [loading, setLoading] = useState(false)

  const handleBuyNow = useCallback(async () => {
    if (!product || product.isOutOfStock) return

    setLoading(true)
    try {
      const res = await fetch("/api/store/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeSlug,
          productId: product.listingId,
        }),
      })
      const data = (await res.json()) as CreateResellerOrderResponse
      if (!res.ok || !data.success || !data.checkoutUrl) {
        toast.error("Commande impossible", {
          description:
            (data.error && ORDER_ERROR_HINTS[data.error]) ||
            "Réessayez dans un instant.",
        })
        return
      }

      window.location.assign(data.checkoutUrl)
    } catch {
      toast.error("Erreur réseau", { description: "Vérifiez votre connexion." })
    } finally {
      setLoading(false)
    }
  }, [product, storeSlug])

  return (
    <ResellerBoutiqueThemeVars theme={getStorefrontThemeById(visualThemeId)}>
      {header}
      <ResellerBoutiqueLayout storeSlug={storeSlug} storeLabel={storeLabel} theme={theme}>
      {!product ? (
        <section
          className="mx-auto max-w-2xl rounded-[1.75rem] border p-10 text-center backdrop-blur-xl"
          style={{
            backgroundColor: "var(--boutique-card-bg)",
            borderColor: "var(--boutique-card-border)",
            boxShadow: "var(--boutique-button-shadow)",
          }}
        >
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg"
            style={{ backgroundImage: "var(--boutique-button-gradient)" }}
          >
            <Sparkles className="h-7 w-7" aria-hidden />
          </div>
          <h2 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">{storeLabel}</h2>
          <p className="mt-3 text-sm leading-relaxed opacity-80">
            {requestedListingId
              ? "Ce produit n'est pas disponible ou l'identifiant listing est invalide."
              : "Ajoute ?productId=TON_LISTING_ID à l'URL pour afficher ton produit phare."}
          </p>
          {requestedListingId ? (
            <p className="mt-2 font-mono text-xs opacity-60">listing: {requestedListingId}</p>
          ) : (
            <p
              className="mt-2 rounded-lg px-3 py-2 font-mono text-[11px]"
              style={{ backgroundColor: "var(--boutique-badge-bg)", color: "var(--boutique-badge-text)" }}
            >
              /boutique/{storeSlug}?productId=&lt;AffiliateProduct.id&gt;
            </p>
          )}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/dashboard/affiliate/brand-studio"
              className="inline-flex h-11 items-center rounded-xl px-5 text-sm font-semibold text-white shadow-md transition hover:opacity-95"
              style={{ backgroundImage: "var(--boutique-button-gradient)" }}
            >
              Personnaliser ma boutique
            </Link>
            <Link
              href="/marketplace"
              className="inline-flex h-11 items-center rounded-xl border px-5 text-sm font-semibold transition hover:opacity-90"
              style={{
                borderColor: "var(--boutique-card-border)",
                backgroundColor: "var(--boutique-powered-bg)",
                color: "var(--boutique-page-text)",
              }}
            >
              Explorer le marketplace
            </Link>
          </div>
        </section>
      ) : (
        <section className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-10">
          <div
            className="overflow-hidden rounded-[1.75rem] border shadow-lg backdrop-blur-sm"
            style={{
              backgroundColor: "var(--boutique-card-bg)",
              borderColor: "var(--boutique-card-border)",
            }}
          >
            <div className="relative aspect-square" style={{ background: "var(--boutique-card-image-bg)" }}>
              <Image
                src={product.imageUrl}
                alt={product.title}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 560px"
                priority
                unoptimized={
                  product.imageUrl.startsWith("http") || product.imageUrl.startsWith("/uploads")
                }
              />
            </div>
          </div>

          <div
            className="rounded-[1.75rem] border p-6 backdrop-blur-xl sm:p-8"
            style={{
              backgroundColor: "var(--boutique-card-bg)",
              borderColor: "var(--boutique-card-border)",
            }}
          >
            <p
              className="text-xs font-semibold uppercase tracking-[0.16em]"
              style={{ color: "var(--boutique-header-muted)" }}
            >
              Produit phare
            </p>
            <h2
              className="mt-2 text-balance text-3xl font-bold tracking-tight sm:text-4xl"
              style={{ color: "var(--boutique-card-title)" }}
            >
              {product.title}
            </h2>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <p
                className="bg-clip-text text-3xl font-bold tabular-nums text-transparent"
                style={{ backgroundImage: "var(--boutique-price-gradient)" }}
              >
                {product.priceLabel}
              </p>
              <span
                className={
                  product.isOutOfStock
                    ? "inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-800"
                    : "inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800"
                }
              >
                <Package className="h-3.5 w-3.5" aria-hidden />
                {product.stockLabel}
              </span>
            </div>
            {product.descriptionExcerpt ? (
              <p className="mt-5 text-sm leading-relaxed" style={{ color: "var(--boutique-card-muted)" }}>
                {product.descriptionExcerpt}
              </p>
            ) : null}

            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <div
                className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium"
                style={{
                  borderColor: "var(--boutique-card-border)",
                  backgroundColor: "var(--boutique-badge-bg)",
                  color: "var(--boutique-card-title)",
                }}
              >
                <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden />
                Paiement sécurisé Affisell
              </div>
              <div
                className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium"
                style={{
                  borderColor: "var(--boutique-card-border)",
                  backgroundColor: "var(--boutique-badge-bg)",
                  color: "var(--boutique-card-title)",
                }}
              >
                <Truck className="h-4 w-4" style={{ color: "var(--boutique-hero-accent)" }} aria-hidden />
                Checkout reseller 1-clic
              </div>
            </div>

            {product.isOutOfStock ? (
              <button
                type="button"
                disabled
                aria-disabled
                className="mt-8 inline-flex h-14 w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-100 text-base font-bold text-zinc-500"
              >
                Rupture de stock
              </button>
            ) : (
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleBuyNow()}
                className="mt-8 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
                style={{
                  backgroundImage: "var(--boutique-button-gradient)",
                  boxShadow: "var(--boutique-button-shadow)",
                }}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                    Création en cours…
                  </>
                ) : (
                  <>
                    Acheter maintenant
                    <ArrowRight className="h-5 w-5" aria-hidden />
                  </>
                )}
              </button>
            )}
            <p className="mt-3 text-center text-[11px] opacity-70">
              {product.isOutOfStock
                ? "Ce produit est indisponible sur le marketplace — alerte stock bientôt."
                : "Commande reseller sécurisée — ta marge est calculée automatiquement."}
            </p>
          </div>
        </section>
      )}
    </ResellerBoutiqueLayout>
    </ResellerBoutiqueThemeVars>
  )
}
