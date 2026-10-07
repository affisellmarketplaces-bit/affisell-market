"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"

import {
  ComplianceField,
  complianceInputClass,
  complianceInputTone,
} from "@/components/supplier/listing-compliance/compliance-field"
import { useDuplicateCheck } from "@/components/supplier/listing-compliance/use-duplicate-check"
import { normalizeGtin } from "@/lib/listing-compliance/gtin"
import { IDENTITY_KEYS } from "@/lib/listing-compliance/keys"
import { cn } from "@/lib/utils"

type Props = {
  values: Record<string, string>
  onChange: (key: string, value: string) => void
  errors?: Partial<Record<string, string>>
  /** The category already renders its own barcode field (key `ean`): do not show a second input bound to the same value. */
  hideGtin?: boolean
  /** Show a brand input. Off in the classic form, where the brand is a category attribute rendered by the form itself. */
  showBrand?: boolean
  /** The listing being edited (never reported as a duplicate of itself). */
  productId?: string | null
  name: string
  mainImageUrl?: string | null
  idPrefix?: string
}

const K = IDENTITY_KEYS

export function IdentityFields({ values, onChange, errors = {}, hideGtin, showBrand, productId, name, mainImageUrl, idPrefix = "compliance" }: Props) {
  const t = useTranslations("supplier.compliance")
  const gtin = values[K.gtin] ?? ""
  const exempt = values[K.gtinExempt] === "1"
  const duplicates = useDuplicateCheck({ gtin, name, imageUrl: mainImageUrl ?? "", excludeId: productId })

  const reasonLabel = (reason: string) =>
    reason === "gtin" ? t("duplicate.gtin") : reason === "same_image" ? t("duplicate.image") : t("duplicate.name")

  return (
    <div className="space-y-4">
      {showBrand ? (
        <ComplianceField id={`${idPrefix}-${K.brand}`} label={t("brandLabel")} hint={t("brandHint")} className="sm:max-w-sm">
          {(a11y) => (
            <input
              {...a11y}
              autoComplete="off"
              value={values[K.brand] ?? ""}
              onChange={(e) => onChange(K.brand, e.target.value)}
              className={cn(complianceInputClass, complianceInputTone(false))}
            />
          )}
        </ComplianceField>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {hideGtin ? null : (
          <div className="space-y-2">
            <ComplianceField id={`${idPrefix}-${K.gtin}`} label={t("gtinLabel")} hint={t("gtinHint")} error={errors[K.gtin]}>
              {(a11y) => (
                <input
                  {...a11y}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder={t("gtinPlaceholder")}
                  disabled={exempt}
                  value={exempt ? "" : gtin}
                  onChange={(e) => onChange(K.gtin, e.target.value)}
                  // Strip spaces / hyphens once the field is left, so what is stored is the plain digit string.
                  onBlur={(e) => {
                    const clean = normalizeGtin(e.target.value)
                    if (clean !== e.target.value) onChange(K.gtin, clean)
                  }}
                  className={cn(complianceInputClass, complianceInputTone(Boolean(errors[K.gtin])), "font-mono")}
                />
              )}
            </ComplianceField>
            <label className="flex items-start gap-2 text-xs text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={exempt}
                onChange={(e) => {
                  onChange(K.gtinExempt, e.target.checked ? "1" : "")
                  if (e.target.checked) onChange(K.gtin, "")
                }}
                className="mt-0.5 size-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
              />
              <span>{t("gtinExemptLabel")}</span>
            </label>
          </div>
        )}
        <ComplianceField id={`${idPrefix}-${K.mpn}`} label={t("mpnLabel")} hint={t("mpnHint")}>
          {(a11y) => (
            <input
              {...a11y}
              autoComplete="off"
              value={values[K.mpn] ?? ""}
              onChange={(e) => onChange(K.mpn, e.target.value)}
              className={cn(complianceInputClass, complianceInputTone(false))}
            />
          )}
        </ComplianceField>
      </div>

      {duplicates.length > 0 ? (
        <div role="status" className="rounded-xl border border-amber-300/70 bg-amber-50 p-3 text-sm dark:border-amber-800/60 dark:bg-amber-950/30">
          <p className="font-semibold text-amber-950 dark:text-amber-100">{t("duplicate.title")}</p>
          <ul className="mt-1.5 space-y-1">
            {duplicates.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-x-2 text-xs text-amber-900 dark:text-amber-200">
                <span className="rounded-full bg-amber-200/70 px-2 py-0.5 font-semibold dark:bg-amber-900/60">{reasonLabel(d.reason)}</span>
                <span className="min-w-0 truncate font-medium">{d.name}</span>
                {d.isDraft ? <span className="text-amber-800/80 dark:text-amber-300/80">· {t("duplicate.draft")}</span> : null}
                <Link
                  href={`/dashboard/supplier/products/${d.id}`}
                  className="font-semibold underline underline-offset-2"
                  target="_blank"
                  rel="noopener"
                >
                  {t("duplicate.open")}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
