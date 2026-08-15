"use client"

import { useTranslations } from "next-intl"

import { BrandStudioGenerateButton } from "@/components/storefront/brand-studio-generate-button"
import type { BrandFieldGenerateResponse } from "@/lib/storefront-brand-field-generate-shared"
import type { BrandLaunchNiche } from "@/lib/storefront-brand-launch"

type Props = {
  role: "AFFILIATE" | "SUPPLIER"
  niche?: BrandLaunchNiche | null
  disabled?: boolean
  onApply: (bannerUrl: string) => void
}

export function StorefrontAiBannerButton({
  role,
  niche = null,
  disabled = false,
  onApply,
}: Props) {
  const t = useTranslations("storefront.brandStudio.aiBanner")

  return (
    <BrandStudioGenerateButton
      field="banner"
      role={role}
      niche={niche}
      disabled={disabled}
      variant="default"
      label={t("cta")}
      hint={t("hint")}
      onApply={(result: BrandFieldGenerateResponse) => {
        if (result.bannerUrl) onApply(result.bannerUrl)
      }}
    />
  )
}
