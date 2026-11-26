"use client"

import { useTranslations } from "next-intl"
import { useEffect, useMemo, useState } from "react"

import type { QualityFeature } from "@/lib/listing-quality/quality-effect"
import { buildSheetChecklist, type QualityEvidence } from "@/lib/listing-quality/sheet-checklist"
import type { BodySheetSignals } from "@/lib/listing-quality/sheet-facts-body"

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 })

/** Evidence is the marketplace aggregate (≥ 5 suppliers each side) — fetched once, empty on any failure. */
export function useQualityEvidence(enabled = true): QualityEvidence[] {
  const [evidence, setEvidence] = useState<QualityEvidence[]>([])
  useEffect(() => {
    if (!enabled) return
    let alive = true
    void fetch("/api/supplier/listing-quality", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { evidence?: Array<{ feature: QualityFeature; adjustedRatio: number | null; lo: number | null }> } | null) => {
        if (!alive || !d || !Array.isArray(d.evidence)) return
        setEvidence(
          d.evidence
            .filter((e) => typeof e.adjustedRatio === "number" && typeof e.lo === "number")
            .map((e) => ({ feature: e.feature, adjustedRatio: e.adjustedRatio as number, lo: e.lo as number })),
        )
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [enabled])
  return evidence
}

/**
 * Live sheet check in the supplier's form: the 12 elements of the sheet-quality measure, read with the SAME rules
 * (`sheetSignals` + `featureValue`) on the body the form is about to send, parsed like the server stores it. A figure appears only for an established marketplace
 * association, with its limit; otherwise elements are facts. Nothing is saved or changed from here.
 */
export function SheetQualityChecklist({ sheet, evidence: given }: { sheet: BodySheetSignals; evidence?: QualityEvidence[] }) {
  const t = useTranslations("supplier.sheetChecklist")
  const tHint = useTranslations("catalogHealth.listingQuality.feature")
  const fetched = useQualityEvidence(given === undefined)
  const evidence = given ?? fetched
  const list = useMemo(() => buildSheetChecklist(sheet.signals, evidence, sheet.defaulted), [sheet, evidence])
  const missing = list.items.filter((i) => i.state === "missing")
  const present = list.items.filter((i) => i.state === "present")
  const defaultedItems = present.filter((i) => i.fromDefault)
  const anyEvidence = list.items.some((i) => i.evidence)

  return (
    <section aria-labelledby="sheet-quality-title" className="space-y-3 rounded-2xl border border-zinc-200 p-4 text-sm dark:border-zinc-800">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="sheet-quality-title" className="font-semibold">{t("title")}</h3>
        <span className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400">{t("summary", { present: list.present, applicable: list.applicable })}</span>
      </div>
      <p className="text-xs text-zinc-600 dark:text-zinc-400">{t("intro")}</p>
      {missing.length === 0 ? (
        <p className="text-emerald-700 dark:text-emerald-400">{t("allDone")}</p>
      ) : (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{t("missingTitle")}</p>
          <ul className="mt-1 space-y-1.5">
            {missing.map((i) => (
              <li key={i.feature} className="rounded-lg bg-amber-50 px-3 py-2 dark:bg-amber-950/30">
                <p>{tHint(i.feature)}</p>
                {i.evidence ? <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">{t("evidence", { ratio: fmt(i.evidence.ratio), lo: fmt(i.evidence.lo) })}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      )}
      {present.length > 0 ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{t("presentTitle")}</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {present.map((i) => (
              <li key={i.feature} className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                {t(`label.${i.feature}`)}
                {i.fromDefault ? ` · ${t("defaultTag")}` : ""}
              </li>
            ))}
          </ul>
          {defaultedItems.length > 0 ? <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{t("deliveryDefault", { min: sheet.signals.deliveryMin ?? 0, max: sheet.signals.deliveryMax ?? 0 })}</p> : null}
        </div>
      ) : null}
      <p className="text-xs text-zinc-500">{anyEvidence ? t("caveat") : t("noEvidence")}</p>
    </section>
  )
}
