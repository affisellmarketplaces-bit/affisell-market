"use client"

import { useTranslations } from "next-intl"
import { useEffect, useMemo, useState } from "react"

import { SheetQualityChecklist, useQualityEvidence } from "@/components/supplier/sheet-quality-checklist"
import { useSupplierFeeBps } from "@/components/supplier/use-supplier-fee-bps"
import { assessCommercialReadiness, type ReadinessFinding, type ReadinessStage } from "@/lib/commercial-readiness/readiness"
import type { ListingReadinessMode } from "@/lib/listing-compliance/mode"

type PublicationRules = { listingReadinessMode: ListingReadinessMode | null; merchantVerified: boolean | null; catalogCapReached: boolean | null }

/** Server-only facts (safety mode, merchant gate, catalogue cap); every unknown stays `null` = not judged. */
function usePublicationRules(): PublicationRules {
  const [rules, setRules] = useState<PublicationRules>({ listingReadinessMode: null, merchantVerified: null, catalogCapReached: null })
  useEffect(() => {
    let alive = true
    void fetch("/api/supplier/publication-rules", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Partial<PublicationRules> | null) => {
        if (!alive || !d) return
        setRules({
          listingReadinessMode: d.listingReadinessMode === "off" || d.listingReadinessMode === "warn" || d.listingReadinessMode === "enforce" ? d.listingReadinessMode : null,
          merchantVerified: typeof d.merchantVerified === "boolean" ? d.merchantVerified : null,
          catalogCapReached: typeof d.catalogCapReached === "boolean" ? d.catalogCapReached : null,
        })
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])
  return rules
}

const VERDICT_STYLE = {
  bloquant: "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100",
  a_corriger: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
  pret: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100",
} as const

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 })

/**
 * « Prêt à commercialiser ? » — the commercial-readiness verdict of the sheet being written, its ONE next correction,
 * the other blockers and priorities, and the sheet-quality detail. Reads the body the form will send (same rules as
 * the server); never saves, never changes anything.
 */
export function CommercialReadinessPanel({
  body,
  creating,
  deliveryTypedBySupplier,
  categoryFieldsMissing,
  stage,
}: {
  /** The request body the form would send now. */
  body: Record<string, unknown>
  /** A NEW product (account-level rules such as the catalogue cap apply); false when editing an existing one. */
  creating: boolean
  deliveryTypedBySupplier?: boolean
  categoryFieldsMissing?: string[] | null
  /** Saved product being edited: `draft` or `live` (rules of THAT stage — a live product is never shown fake refusals). Default: `new` when creating. */
  stage?: ReadinessStage
}) {
  const t = useTranslations("supplier.readiness")
  const tFeature = useTranslations("catalogHealth.listingQuality.feature")
  const rules = usePublicationRules()
  const evidence = useQualityEvidence()
  const { bps } = useSupplierFeeBps(typeof body.categoryId === "string" ? body.categoryId : "")
  const report = useMemo(
    () =>
      assessCommercialReadiness(body, {
        listingReadinessMode: rules.listingReadinessMode,
        merchantVerified: rules.merchantVerified,
        catalogCapReached: creating || stage === "draft" ? rules.catalogCapReached : null,
        stage: stage ?? (creating ? "new" : undefined),
        supplierFeeBps: bps,
        categoryFieldsMissing,
        deliveryTypedBySupplier,
        evidence,
      }),
    [body, rules, creating, stage, bps, categoryFieldsMissing, deliveryTypedBySupplier, evidence],
  )

  const title = (f: ReadinessFinding) => (f.feature ? tFeature(f.feature) : t(`finding.${f.code}.title`))
  const why = (f: ReadinessFinding) => (f.feature ? t("qualityWhy") : t(`finding.${f.code}.${f.live ? "whyLive" : "why"}`))
  const others = report.findings.filter((f) => f !== report.nextFix && f.level !== "recommande")

  return (
    <section aria-labelledby="commercial-readiness-title" className="space-y-3 rounded-2xl border border-zinc-200 p-4 text-sm dark:border-zinc-800">
      <div className={`rounded-xl border px-3 py-2 ${VERDICT_STYLE[report.verdict]}`}>
        <h3 id="commercial-readiness-title" className="font-semibold">{t(`verdict.${report.verdict}`)}</h3>
        <p className="mt-0.5 text-xs">
          {t("counts", { blocking: report.counts.bloquant, priority: report.counts.prioritaire, recommended: report.counts.recommande })}
        </p>
      </div>

      {report.nextFix ? (
        <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3 dark:border-violet-900 dark:bg-violet-950/30">
          <p className="text-xs font-medium uppercase tracking-wide text-violet-700 dark:text-violet-300">{t("nextFix")}</p>
          <p className="mt-1 font-semibold">{title(report.nextFix)}</p>
          <p className="mt-1 text-xs text-zinc-700 dark:text-zinc-300">{why(report.nextFix)}</p>
          {report.nextFix.feature ? null : <p className="mt-1 text-xs">{t(`finding.${report.nextFix.code}.fix`)}</p>}
          {report.nextFix.code === "category_fields_missing" && report.nextFix.fields?.length ? (
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{report.nextFix.fields.join(" · ")}</p>
          ) : null}
          {report.nextFix.evidence ? (
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{t("evidence", { ratio: fmt(report.nextFix.evidence.ratio), lo: fmt(report.nextFix.evidence.lo) })}</p>
          ) : null}
          <p className="mt-2 text-[11px] text-zinc-500">{t(`basis.${report.nextFix.basis}`)}</p>
        </div>
      ) : null}

      {others.length > 0 ? (
        <ul className="space-y-1.5">
          {others.map((f) => (
            <li key={f.code} className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800">
              <p className="font-medium">
                <span className={f.level === "bloquant" ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}>{t(`level.${f.level}`)}</span>
                {" · "}
                {title(f)}
              </p>
              <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">{t(`finding.${f.code}.fix`)}</p>
              {f.code === "category_fields_missing" && f.fields?.length ? <p className="mt-0.5 text-xs text-zinc-500">{f.fields.join(" · ")}</p> : null}
              <p className="mt-0.5 text-[11px] text-zinc-500">{t(`basis.${f.basis}`)}</p>
            </li>
          ))}
        </ul>
      ) : null}

      <details className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
        <summary className="cursor-pointer text-xs font-medium">{t("qualityDetail")}</summary>
        <div className="mt-3">
          <SheetQualityChecklist sheet={report.sheet} evidence={evidence} />
        </div>
      </details>
      <p className="text-[11px] text-zinc-500">{t("footer")}</p>
    </section>
  )
}
