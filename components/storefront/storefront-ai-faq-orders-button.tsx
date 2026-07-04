"use client"

import { Loader2, Sparkles } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useCallback, useState } from "react"

import { Button } from "@/components/ui/button"
import { capturePosthogClient } from "@/lib/analytics/posthog"
import type { StorefrontFaqItem } from "@/lib/storefront-static-pages-shared"
import { updateStaticPage } from "@/lib/storefront-static-pages-shared"
import type { StorefrontStaticPages } from "@/lib/storefront-static-pages-shared"

type Props = {
  role: "AFFILIATE" | "SUPPLIER"
  pages: StorefrontStaticPages
  disabled?: boolean
  onApply: (pages: StorefrontStaticPages) => void
}

export function StorefrontAiFaqOrdersButton({ role, pages, disabled = false, onApply }: Props) {
  const t = useTranslations("storefront.brandStudio.aiFaqOrders")
  const locale = useLocale()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/store/generate-brand-faq-from-orders", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale }),
      })
      const json = (await res.json()) as { faqItems?: StorefrontFaqItem[]; error?: string }
      if (!res.ok || !json.faqItems) {
        throw new Error(json.error ?? t("failed"))
      }
      const next = updateStaticPage(pages, "faq", {
        enabled: true,
        title: pages.faq.title ?? "FAQ",
        faqItems: json.faqItems,
      })
      onApply(next)
      capturePosthogClient("brand_ai_faq_orders_generated", { role, itemCount: json.faqItems.length })
      console.log("[brand-studio]", { event: "ai_faq_orders_generated", role, result: "ok" })
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("failed")
      setError(msg)
      console.log("[brand-studio]", { event: "ai_faq_orders_generated", role, result: "error", error: msg })
    } finally {
      setBusy(false)
    }
  }, [locale, onApply, pages, role, t])

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || busy}
        onClick={() => void generate()}
        className="border-indigo-300/70 text-indigo-900 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-100"
      >
        {busy ? (
          <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="mr-2 size-4" aria-hidden />
        )}
        {busy ? t("generating") : t("cta")}
      </Button>
      <p className="text-[11px] text-gray-500 dark:text-zinc-500">{t("hint")}</p>
      {error ? <p className="text-[11px] text-rose-600 dark:text-rose-400">{error}</p> : null}
    </div>
  )
}
