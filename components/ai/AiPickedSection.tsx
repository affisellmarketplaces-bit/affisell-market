"use client"

import { useTranslations } from "next-intl"

export function AiPickedSection() {
  const t = useTranslations("AI")

  return (
    <section className="space-y-2 rounded-xl border border-zinc-200 bg-white p-4">
      <h3 className="text-sm font-semibold">{t("pickedForYou")}</h3>
      <p className="text-xs text-zinc-600">{t("offerEndsIn", { time: "2h14" })}</p>
      <div className="flex items-center gap-2 text-xs">
        <span>{t("trending")}</span>
        <span>•</span>
        <span>{t("views", { count: 39 })}</span>
      </div>
      <button type="button" className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs text-white">
        {t("add")}
      </button>
      <p className="text-xs text-zinc-500">{t("whyRecommended")}</p>
    </section>
  )
}
