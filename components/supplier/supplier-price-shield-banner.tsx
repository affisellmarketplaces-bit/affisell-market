"use client"

import { useEffect, useState } from "react"
import { Shield } from "lucide-react"
import { useTranslations } from "next-intl"

type Props = {
  productId: string
  className?: string
}

type Impact = {
  listedAffiliateCount: number
  isLive: boolean
}

export function SupplierPriceShieldBanner({ productId, className }: Props) {
  const t = useTranslations("supplierDashboard.priceShield")
  const [impact, setImpact] = useState<Impact | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetch(`/api/supplier/products/${encodeURIComponent(productId)}/remove-impact`, {
      credentials: "include",
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((data: Impact & { error?: string }) => {
        if (cancelled) return
        if (data.listedAffiliateCount > 0 && data.isLive) {
          setImpact({
            listedAffiliateCount: data.listedAffiliateCount,
            isLive: data.isLive,
          })
        } else {
          setImpact(null)
        }
      })
      .catch(() => {
        if (!cancelled) setImpact(null)
      })
    return () => {
      cancelled = true
    }
  }, [productId])

  if (!impact) return null

  return (
    <div
      className={
        className ??
        "mb-6 overflow-hidden rounded-2xl border border-cyan-400/25 bg-gradient-to-r from-cyan-950/40 via-violet-950/30 to-zinc-950/80 px-4 py-3"
      }
      role="status"
      data-testid="supplier-price-shield-banner"
    >
      <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-200">
        <Shield className="size-3.5" aria-hidden />
        Price Shield
      </p>
      <p className="mt-1 text-sm text-zinc-200">
        {t("bannerBody", { count: impact.listedAffiliateCount })}
      </p>
    </div>
  )
}
