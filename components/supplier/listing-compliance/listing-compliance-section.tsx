"use client"

import { CheckCircle2, TriangleAlert } from "lucide-react"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"

import { GpsrFields } from "@/components/supplier/listing-compliance/gpsr-fields"
import { IdentityFields } from "@/components/supplier/listing-compliance/identity-fields"
import { useComplianceProfile } from "@/components/supplier/listing-compliance/use-compliance-profile"
import { evaluateListingReadiness, type ReadinessIssue } from "@/lib/listing-compliance/evaluate"
import { cn } from "@/lib/utils"

type Props = {
  /** Attribute values keyed by attribute key — the same record the form already keeps for category attributes. */
  values: Record<string, string>
  onChange: (key: string, value: string) => void
  listingKind: string
  productId?: string | null
  name: string
  mainImageUrl?: string | null
  /** The category already renders its own barcode (`ean`) field. */
  hideGtin?: boolean
  /** Show a brand input (the guided wizard has none; the classic form renders brand as a category attribute). */
  showBrand?: boolean
  /** Issues returned by the server (422 `listing_not_ready`): shown on the fields straight away. */
  serverIssues?: ReadinessIssue[] | null
  idPrefix?: string
  className?: string
}

/**
 * Product identity + product-safety (GPSR) data for one listing, with a live "what is still missing" summary.
 * Pure UI over a values record: it neither fetches the product nor saves anything (the form's payload carries the values).
 */
export function ListingComplianceSection({
  values,
  onChange,
  listingKind,
  productId,
  name,
  mainImageUrl,
  hideGtin,
  showBrand,
  serverIssues,
  idPrefix = "compliance",
  className,
}: Props) {
  const t = useTranslations("supplier.compliance")
  const { profile } = useComplianceProfile()
  const [touched, setTouched] = useState<Set<string>>(() => new Set())

  const readiness = useMemo(() => evaluateListingReadiness({ listingKind, attributes: values }), [listingKind, values])

  const issues: ReadinessIssue[] = useMemo(() => {
    const merged = new Map<string, ReadinessIssue>()
    for (const i of readiness.issues) merged.set(i.code, i)
    for (const i of serverIssues ?? []) merged.set(i.code, i)
    return [...merged.values()]
  }, [readiness.issues, serverIssues])

  // Field errors appear once the visitor has been through a field (or the server refused the publication).
  const errors = useMemo(() => {
    const out: Record<string, string> = {}
    const serverCodes = new Set((serverIssues ?? []).map((i) => i.code))
    for (const i of issues) {
      if (i.severity !== "blocking") continue
      if (touched.has(i.field) || serverCodes.has(i.code)) out[i.field] = t(`issue.${i.code}`)
    }
    return out
  }, [issues, serverIssues, touched, t])

  if (!readiness.applicable) return null

  const handleChange = (key: string, value: string) => {
    onChange(key, value)
    setTouched((prev) => (prev.has(key) ? prev : new Set(prev).add(key)))
  }

  const blocking = issues.filter((i) => i.severity === "blocking")
  const advisory = issues.filter((i) => i.severity === "advisory")
  const focusField = (field: string) => {
    // Brand is a category attribute rendered by the form itself (its inputs carry no id): scroll to that block instead.
    const el = document.getElementById(`${idPrefix}-${field}`) ?? document.getElementById("product-spec-fields")
    el?.scrollIntoView({ block: "center", behavior: "smooth" })
    if (el && ["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName)) (el as HTMLElement).focus({ preventScroll: true })
  }

  return (
    <div className={cn("space-y-6", className)}>
      <div
        role="status"
        className={cn(
          "rounded-2xl border p-4 text-sm",
          blocking.length === 0
            ? "border-emerald-300/70 bg-emerald-50 text-emerald-950 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-100"
            : "border-amber-300/70 bg-amber-50 text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100"
        )}
      >
        <p className="flex items-center gap-2 font-semibold">
          {blocking.length === 0 ? (
            <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          ) : (
            <TriangleAlert className="size-4 shrink-0" aria-hidden />
          )}
          {blocking.length === 0 ? t("statusReady") : t("statusMissing")}
        </p>
        {blocking.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {blocking.map((i) => (
              <li key={i.code}>
                <button type="button" onClick={() => focusField(i.field)} className="text-left text-xs font-medium underline-offset-2 hover:underline">
                  {t(`issue.${i.code}`)}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {advisory.length > 0 ? (
          <div className="mt-3 border-t border-current/10 pt-2">
            <p className="text-[11px] font-bold uppercase tracking-wide opacity-70">{t("advisoryHeading")}</p>
            <ul className="mt-1 space-y-0.5">
              {advisory.map((i) => (
                <li key={i.code}>
                  <button type="button" onClick={() => focusField(i.field)} className="text-left text-xs underline-offset-2 hover:underline">
                    {t(`issue.${i.code}`)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-bold text-zinc-900 dark:text-zinc-50">{t("identityHeading")}</h3>
        <IdentityFields
          values={values}
          onChange={handleChange}
          errors={errors}
          hideGtin={hideGtin}
          showBrand={showBrand}
          productId={productId}
          name={name}
          mainImageUrl={mainImageUrl}
          idPrefix={idPrefix}
        />
      </div>

      <GpsrFields variant="product" values={values} onChange={handleChange} errors={errors} profile={profile} idPrefix={idPrefix} />
    </div>
  )
}

