"use client"

import { useTranslations } from "next-intl"

import { BrandStudioGenerateButton } from "@/components/storefront/brand-studio-generate-button"
import type { BrandFieldGenerateResponse } from "@/lib/storefront-brand-field-generate-shared"
import type { StorefrontStaticPages } from "@/lib/storefront-static-pages-shared"

type Props = {
  role: "AFFILIATE" | "SUPPLIER"
  pages: StorefrontStaticPages
  disabled?: boolean
  onApply: (pages: StorefrontStaticPages) => void
}

export function StorefrontAiFaqOrdersButton({ role, disabled = false, onApply }: Props) {
  const t = useTranslations("storefront.brandStudio.aiFaqOrders")

  return (
    <BrandStudioGenerateButton
      field="faqOrders"
      role={role}
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
