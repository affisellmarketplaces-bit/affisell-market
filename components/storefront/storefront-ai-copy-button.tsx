"use client"

import { useTranslations } from "next-intl"

import { BrandStudioGenerateButton } from "@/components/storefront/brand-studio-generate-button"
import type { BrandFieldGenerateResponse } from "@/lib/storefront-brand-field-generate-shared"
import type { BrandLaunchNiche } from "@/lib/storefront-brand-launch"
import type { HomepageSection } from "@/lib/storefront-sections-shared"

type Props = {
  storeName: string
  role: "AFFILIATE" | "SUPPLIER"
  niche?: BrandLaunchNiche | null
  disabled?: boolean
  onApply: (result: {
    description: string
    homepageSections: HomepageSection[]
  }) => void
  homepageSections: HomepageSection[]
}

export function StorefrontAiCopyButton({
  role,
  niche = null,
  disabled = false,
  onApply,
}: Props) {
  const t = useTranslations("storefront.brandStudio.aiCopy")

  return (
    <BrandStudioGenerateButton
      field="copy"
      role={role}
      niche={niche}
      disabled={disabled}
      variant="default"
      label={t("cta")}
      hint={t("hint")}
      onApply={(result: BrandFieldGenerateResponse) => {
        if (result.description && result.homepageSections) {
          onApply({ description: result.description, homepageSections: result.homepageSections })
        } else if (result.description) {
          onApply({ description: result.description, homepageSections: [] })
        }
      }}
    />
  )
}
