"use client"

import Link from "next/link"
import { Sparkles } from "lucide-react"

import { ResellerBoutiqueLayout } from "@/components/boutique/ResellerBoutiqueLayout"
import type { ResellerBoutiqueThemeProps } from "@/lib/boutique/reseller-boutique-theme-shared"

type Props = {
  storeSlug: string
  storeLabel: string
  theme: ResellerBoutiqueThemeProps
}

export function ResellerStorefrontEmptyState({ storeSlug, storeLabel, theme }: Props) {
  return (
    <ResellerBoutiqueLayout storeSlug={storeSlug} storeLabel={storeLabel} theme={theme}>
      <section
        className="mx-auto flex min-h-[50vh] max-w-2xl items-center justify-center"
      >
        <div
          className="w-full rounded-[1.75rem] border p-10 text-center backdrop-blur-xl"
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
          <h1 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">
            Boutique{" "}
            <span style={{ color: "var(--boutique-hero-accent)" }}>{storeLabel}</span>
          </h1>
          <p className="mt-3 text-sm leading-relaxed opacity-80">
            Boutique vide — ajoute depuis{" "}
            <Link
              href="/dashboard/affiliate"
              className="font-semibold underline-offset-2 hover:underline"
              style={{ color: "var(--boutique-hero-accent)" }}
            >
              /dashboard/affiliate
            </Link>{" "}
            ou choisis un thème dans{" "}
            <Link
              href="/dashboard/affiliate/brand-studio"
              className="font-semibold underline-offset-2 hover:underline"
              style={{ color: "var(--boutique-hero-accent)" }}
            >
              Brand Studio
            </Link>
          </p>
          <p className="mt-2 font-mono text-[11px] opacity-60">/boutique/{storeSlug}</p>
        </div>
      </section>
    </ResellerBoutiqueLayout>
  )
}
