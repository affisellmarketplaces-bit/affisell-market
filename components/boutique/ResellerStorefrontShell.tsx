"use client"

import Link from "next/link"
import { Sparkles } from "lucide-react"
import type { ReactNode } from "react"

import { ResellerBoutiqueLayout } from "@/components/boutique/ResellerBoutiqueLayout"
import { ResellerBoutiqueProductDetailPanel } from "@/components/boutique/reseller-boutique-product-detail"
import { ResellerBoutiqueThemeVars } from "@/components/boutique/reseller-boutique-theme-vars"
import type { ResellerBoutiqueProductDetail } from "@/lib/boutique/load-reseller-storefront.server"
import type { ResellerBoutiqueThemeProps } from "@/lib/boutique/reseller-boutique-theme-shared"
import {
  DEFAULT_STOREFRONT_THEME_ID,
  getStorefrontThemeById,
  type StorefrontTheme,
} from "@/lib/boutique/storefront-themes"

type ResellerStorefrontShellProps = {
  storeSlug: string
  storeLabel: string
  theme: ResellerBoutiqueThemeProps
  product: ResellerBoutiqueProductDetail | null
  requestedListingId: string | null
  header?: ReactNode
  visualThemeId?: StorefrontTheme
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
          <ResellerBoutiqueProductDetailPanel storeSlug={storeSlug} product={product} />
        )}
      </ResellerBoutiqueLayout>
    </ResellerBoutiqueThemeVars>
  )
}
