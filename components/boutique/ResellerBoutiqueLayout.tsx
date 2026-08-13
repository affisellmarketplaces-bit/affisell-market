"use client"

import Link from "next/link"
import { Sparkles } from "lucide-react"
import type { ReactNode } from "react"

import { ResellerBoutiqueThemeStyles } from "@/components/boutique/ResellerBoutiqueThemeStyles"
import { ResellerBoutiqueAmbientFx } from "@/components/boutique/ResellerBoutiqueAmbientFx"
import type { ResellerBoutiqueThemeProps } from "@/lib/boutique/reseller-boutique-theme-shared"

type ResellerBoutiqueLayoutProps = {
  storeSlug: string
  storeLabel: string
  theme: ResellerBoutiqueThemeProps
  productCount?: number | null
  hero?: ReactNode
  children: ReactNode
  footer?: ReactNode
}

export function ResellerBoutiqueLayout({
  storeSlug,
  storeLabel,
  theme,
  productCount,
  hero,
  children,
  footer,
}: ResellerBoutiqueLayoutProps) {
  return (
    <>
      <ResellerBoutiqueThemeStyles theme={theme} />
      <div
        className="relative min-h-screen overflow-hidden"
        style={{ background: "var(--boutique-page-bg)", color: "var(--boutique-page-text)" }}
      >
        <ResellerBoutiqueAmbientFx />
        <div
          className="pointer-events-none absolute -left-24 top-40 h-72 w-72 rounded-full blur-3xl boutique-float"
          style={{ backgroundColor: "var(--boutique-glow-primary)" }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-16 bottom-20 h-80 w-80 rounded-full blur-3xl"
          style={{ backgroundColor: "var(--boutique-glow-accent)" }}
          aria-hidden
        />

        <header
          className="sticky top-0 z-20 border-b backdrop-blur-xl"
          style={{
            backgroundColor: "var(--boutique-header-bg)",
            borderColor: "var(--boutique-header-border)",
          }}
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: "var(--boutique-header-muted)" }}
              >
                Boutique reseller
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                <h1 className="truncate text-lg font-bold tracking-tight sm:text-xl">
                  {storeLabel}
                </h1>
                {typeof productCount === "number" ? (
                  <span
                    className="inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tabular-nums"
                    style={{
                      backgroundColor: "var(--boutique-badge-bg)",
                      borderColor: "var(--boutique-badge-border)",
                      color: "var(--boutique-badge-text)",
                    }}
                  >
                    {productCount} produit{productCount > 1 ? "s" : ""}
                  </span>
                ) : null}
              </div>
            </div>
            <Link
              href="/"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition hover:opacity-90"
              style={{
                backgroundColor: "var(--boutique-powered-bg)",
                borderColor: "var(--boutique-powered-border)",
                color: "var(--boutique-powered-text)",
              }}
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Powered by Affisell
            </Link>
          </div>
        </header>

        <main className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
          {hero ? <div className="mb-8 sm:mb-10">{hero}</div> : null}
          {children}
        </main>

        {footer ?? (
          <footer
            className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t px-4 pb-8 pt-6 text-xs sm:px-6"
            style={{ borderColor: "var(--boutique-header-border)", color: "var(--boutique-footer-text)" }}
          >
            <span>
              Boutique `{storeSlug}` · Affisell Reseller
              {theme.presetId ? ` · ${theme.presetId}` : ""}
            </span>
            <Link
              href="/marketplace"
              className="font-semibold hover:opacity-80"
              style={{ color: "var(--boutique-footer-link)" }}
            >
              Marketplace →
            </Link>
          </footer>
        )}
      </div>
    </>
  )
}
