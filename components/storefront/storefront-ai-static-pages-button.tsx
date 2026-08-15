"use client"

import { useTranslations } from "next-intl"

import { BrandStudioGenerateButton } from "@/components/storefront/brand-studio-generate-button"
import type { BrandFieldGenerateResponse } from "@/lib/storefront-brand-field-generate-shared"
import type { BrandLaunchNiche } from "@/lib/storefront-brand-launch"
import type { StorefrontStaticPages } from "@/lib/storefront-static-pages-shared"

type Props = {
  role: "AFFILIATE" | "SUPPLIER"
  niche?: BrandLaunchNiche | null
  disabled?: boolean
  onApply: (pages: StorefrontStaticPages) => void
}

export function StorefrontAiStaticPagesButton({
  role,
  niche = null,
  disabled = false,
  onApply,
}: Props) {
  const t = useTranslations("storefront.brandStudio.aiStaticPages")

  return (
    <BrandStudioGenerateButton
      field="staticPages"
      role={role}
      niche={niche}
      disabled={disabled}
      variant="default"
      label={t("cta")}
      hint={t("hint")}
      onApply={(result: BrandFieldGenerateResponse) => {
        if (result.staticPages) onApply(result.staticPages)
      }}
    />
  )
}
