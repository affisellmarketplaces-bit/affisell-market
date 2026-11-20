"use client"

import { CheckCircle2, Circle, Clock, Lock, MinusCircle } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

import type { JourneyStatus, JourneyStep } from "@/lib/supplier-journey/product-journey"

const ICON: Record<JourneyStatus, typeof Circle> = {
  done: CheckCircle2,
  todo: Circle,
  blocked: Lock,
  waiting: Clock,
  optional: MinusCircle,
}
const TONE: Record<JourneyStatus, string> = {
  done: "text-emerald-600",
  todo: "text-amber-600",
  blocked: "text-red-600",
  waiting: "text-zinc-500",
  optional: "text-zinc-400",
}

/** Where this saved product stands, from the sheet to the first sales (lib/supplier-journey/product-journey.ts). */
export function ProductJourneyPanel({ productId }: { productId: string }) {
  const t = useTranslations("supplier.productJourney")
  const [data, setData] = useState<{ steps: JourneyStep[]; next: string | null } | null>(null)

  useEffect(() => {
    let alive = true
    void fetch(`/api/supplier/products/${encodeURIComponent(productId)}/journey`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && j) setData(j as { steps: JourneyStep[]; next: string | null })
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [productId])

  if (!data) return null
  const detail = (s: JourneyStep): string | null => {
    if (!s.detail) return null
    switch (s.id) {
      case "sheet":
        return s.detail
          .split(",")
          .map((k) => t(`missing.${k}`))
          .join(", ")
      case "safety":
        return t("safetyMissing", { count: s.detail.split(",").length })
      case "stock":
        return t("units", { count: Number(s.detail) })
      case "commission":
        return `${s.detail} %`
      case "publication":
        return t(`publication.${s.detail}`)
      case "resellers":
        return t("resellers", { count: Number(s.detail) })
      case "sales":
        return t("sales", { count: Number(s.detail) })
      case "costs":
        return t(`costs.${s.detail}`)
      default:
        return null
    }
  }

  return (
    <div className="space-y-3">
      {data.next ? <p className="text-sm font-medium">{t("next", { step: t(`steps.${data.next}`) })}</p> : <p className="text-sm font-medium">{t("allDone")}</p>}
      <ol className="space-y-2">
        {data.steps.map((s) => {
          const Icon = ICON[s.status]
          const d = detail(s)
          return (
            <li key={s.id} className="flex items-start gap-2 text-sm">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${TONE[s.status]}`} aria-hidden />
              <span>
                <span className="font-medium">{t(`steps.${s.id}`)}</span>
                <span className="text-zinc-500"> · {t(`status.${s.status}`)}</span>
                {d ? <span className="text-zinc-500"> · {d}</span> : null}
              </span>
            </li>
          )
        })}
      </ol>
      <p className="text-xs text-zinc-500">{t("costsNote")}</p>
    </div>
  )
}
