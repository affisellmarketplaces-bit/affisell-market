"use client"

import { BadgeCheck, ShieldCheck, Sparkles, Truck } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslations } from "next-intl"

import type { StorefrontTrustSnapshot } from "@/lib/storefront-trust-shared"
import { cn } from "@/lib/utils"

type Props = {
  trust: StorefrontTrustSnapshot | null
  className?: string
}

function Sep() {
  return (
    <span
      className="hidden h-3 w-px shrink-0 sm:inline"
      style={{ background: "var(--boutique-merchant-header-divider, rgba(255,255,255,0.2))" }}
      aria-hidden
    />
  )
}

function Chip({
  children,
  accent = false,
}: {
  children: ReactNode
  accent?: boolean
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.12em] sm:text-[11px] sm:tracking-[0.16em]"
      )}
      style={{
        color: accent
          ? "var(--boutique-accent, #7c3aed)"
          : "var(--boutique-merchant-header-text-muted, rgba(255,255,255,0.86))",
      }}
    >
      {children}
    </span>
  )
}

/** Buyer trust signals — tints from procedural boutique theme vars. */
export function BoutiqueBuyerTrustStrip({ trust, className }: Props) {
  const t = useTranslations("boutique.trust")
  const tCard = useTranslations("boutique.productCard")

  return (
    <div
      className={cn(
        "relative overflow-hidden border-t backdrop-blur-md transition-colors duration-700 ease-in-out",
        className
      )}
      style={{
        borderColor: "var(--boutique-merchant-header-divider, rgba(255,255,255,0.12))",
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--boutique-merchant-header-via, #312e81) 18%, transparent), transparent)",
      }}
      role="region"
      aria-label={t("headerTrustAria")}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--boutique-accent-soft, rgba(124,58,237,0.35)), transparent)",
        }}
        aria-hidden
      />
      <div className="relative mx-auto flex h-8 max-w-[1600px] items-center gap-2 overflow-x-auto px-4 sm:h-9 sm:gap-3 sm:px-6 lg:px-10 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Chip accent>
          <Sparkles className="size-3 shrink-0 opacity-90" aria-hidden />
          {t("poweredBy")}
        </Chip>
        <Sep />
        <Chip>
          <ShieldCheck className="size-3 shrink-0 opacity-90" aria-hidden />
          <span className="hidden sm:inline">{t("platformSecured")}</span>
          <span className="sm:hidden">{t("securedShort")}</span>
        </Chip>
        {trust?.merchantVerified ? (
          <>
            <Sep />
            <Chip>
              <BadgeCheck className="size-3 shrink-0 opacity-90" aria-hidden />
              <span className="hidden sm:inline">{t("merchantVerified")}</span>
              <span className="sm:hidden">{t("verifiedShort")}</span>
            </Chip>
          </>
        ) : null}
        <Sep />
        <Chip>
          <Truck className="size-3 shrink-0 opacity-90" aria-hidden />
          <span className="hidden md:inline">{tCard("trustLine")}</span>
          <span className="md:hidden">{t("secureCheckout")}</span>
        </Chip>
      </div>
    </div>
  )
}
