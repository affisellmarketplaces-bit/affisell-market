"use client"

import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { useMemo } from "react"

import {
  ComplianceField,
  complianceInputClass,
  complianceInputTone,
} from "@/components/supplier/listing-compliance/compliance-field"
import { countryOptions } from "@/lib/listing-compliance/countries"
import { isCountryCode, isEuCountry } from "@/lib/listing-compliance/eu-countries"
import { GPSR_KEYS } from "@/lib/listing-compliance/keys"
import { useHydrated } from "@/lib/use-hydrated"
import {
  euRepAttributesFromProfile,
  hasEuRepBlock,
  hasManufacturerBlock,
  manufacturerAttributesFromProfile,
  type ComplianceProfile,
} from "@/lib/listing-compliance/profile-shared"
import { cn } from "@/lib/utils"

export type GpsrFieldsProps = {
  /** Values keyed by attribute key (gpsr_*). */
  values: Record<string, string>
  onChange: (key: string, value: string) => void
  /** Field-level messages (already translated), keyed by attribute key. Shown on the field. */
  errors?: Partial<Record<string, string>>
  /**
   * "product": one listing — extra safety fields, the EU responsible person only when the manufacturer is outside the EU.
   * "profile": the supplier's defaults — the EU responsible person is always editable.
   */
  variant: "product" | "profile"
  /** Saved defaults offered as a one-click (never silent) prefill — product variant. */
  profile?: ComplianceProfile | null
  /** Where "Edit my profile" leads. */
  profileHref?: string
  idPrefix?: string
  /** Every field is required-marked in the product variant (EU rules); the profile may stay partial. */
  className?: string
}

const K = GPSR_KEYS

export function GpsrFields({
  values,
  onChange,
  errors = {},
  variant,
  profile = null,
  profileHref = "/dashboard/supplier/settings/compliance",
  idPrefix = "compliance",
  className,
}: GpsrFieldsProps) {
  const t = useTranslations("supplier.compliance")
  const locale = useLocale()
  // Country names and their sort order come from the platform's ICU data, which differs between the Node server and the
  // browser: rendering the full list on the server made React report a hydration mismatch. The server and the first client
  // render only carry the current choice; the full, localized list appears right after hydration.
  const hydrated = useHydrated()
  const countries = useMemo(() => (hydrated ? countryOptions(locale) : []), [hydrated, locale])
  const isProduct = variant === "product"
  const v = (key: string) => values[key] ?? ""
  const id = (key: string) => `${idPrefix}-${key}`

  const country = v(K.manufacturerCountry)
  const euRepRequired = isCountryCode(country) && !isEuCountry(country)
  const showEuRep = !isProduct || euRepRequired

  const manufacturerPrefill = profile && hasManufacturerBlock(profile) ? manufacturerAttributesFromProfile(profile) : null
  const euRepPrefill = profile && hasEuRepBlock(profile) ? euRepAttributesFromProfile(profile) : null
  const differs = (attrs: Record<string, string> | null) => Boolean(attrs && Object.entries(attrs).some(([k, val]) => v(k) !== val))
  const apply = (attrs: Record<string, string> | null) => {
    if (!attrs) return
    for (const [k, val] of Object.entries(attrs)) onChange(k, val)
  }

  const text = (key: string, label: string, opts: { type?: string; autoComplete?: string; hint?: string; required?: boolean } = {}) => (
    <ComplianceField id={id(key)} label={label} hint={opts.hint} error={errors[key]} required={isProduct && opts.required !== false}>
      {(a11y) => (
        <input
          {...a11y}
          type={opts.type ?? "text"}
          autoComplete={opts.autoComplete}
          value={v(key)}
          onChange={(e) => onChange(key, e.target.value)}
          className={cn(complianceInputClass, complianceInputTone(Boolean(errors[key])))}
        />
      )}
    </ComplianceField>
  )

  const prefillButton = (label: string, attrs: Record<string, string> | null) =>
    isProduct && differs(attrs) ? (
      <button
        type="button"
        onClick={() => apply(attrs)}
        className="inline-flex min-h-9 items-center rounded-full border border-violet-300 bg-violet-50 px-3 text-xs font-semibold text-violet-800 transition hover:bg-violet-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200"
      >
        {label}
      </button>
    ) : null

  return (
    <div className={cn("space-y-6", className)}>
      <fieldset className="min-w-0 space-y-4">
        <legend className="flex w-full flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{t("manufacturerHeading")}</span>
          {prefillButton(t("useMyManufacturer"), manufacturerPrefill)}
        </legend>
        <p className="-mt-2 text-xs text-zinc-500 dark:text-zinc-400">{t("manufacturerHint")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {text(K.manufacturerName, t("manufacturerName"), { autoComplete: "organization" })}
          {text(K.manufacturerEmail, t("manufacturerEmail"), { type: "email", autoComplete: "email" })}
        </div>
        <ComplianceField id={id(K.manufacturerAddress)} label={t("manufacturerAddress")} error={errors[K.manufacturerAddress]} required={isProduct}>
          {(a11y) => (
            <textarea
              {...a11y}
              rows={2}
              autoComplete="street-address"
              value={v(K.manufacturerAddress)}
              onChange={(e) => onChange(K.manufacturerAddress, e.target.value)}
              className={cn(complianceInputClass, complianceInputTone(Boolean(errors[K.manufacturerAddress])), "resize-y")}
            />
          )}
        </ComplianceField>
        <ComplianceField id={id(K.manufacturerCountry)} label={t("manufacturerCountry")} error={errors[K.manufacturerCountry]} required={isProduct} className="sm:max-w-xs">
          {(a11y) => (
            <select
              {...a11y}
              autoComplete="country"
              value={country.toUpperCase()}
              onChange={(e) => onChange(K.manufacturerCountry, e.target.value)}
              className={cn(complianceInputClass, complianceInputTone(Boolean(errors[K.manufacturerCountry])))}
            >
              <option value="">{t("countryPlaceholder")}</option>
              {!hydrated && country ? <option value={country.toUpperCase()}>{country.toUpperCase()}</option> : null}
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </ComplianceField>
      </fieldset>

      {showEuRep ? (
        <fieldset className="min-w-0 space-y-4 rounded-2xl border border-amber-200/80 bg-amber-50/50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
          <legend className="flex w-full flex-wrap items-center justify-between gap-2 px-1">
            <span className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{t("euRepHeading")}</span>
            {prefillButton(t("useMyEuRep"), euRepPrefill)}
          </legend>
          <p className="-mt-2 text-xs text-zinc-600 dark:text-zinc-300">{isProduct ? t("euRepHint") : t("profile.euRepNote")}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {text(K.euRepName, t("euRepName"), { autoComplete: "organization", required: euRepRequired })}
            {text(K.euRepEmail, t("euRepEmail"), { type: "email", autoComplete: "email", required: euRepRequired })}
          </div>
          <ComplianceField id={id(K.euRepAddress)} label={t("euRepAddress")} error={errors[K.euRepAddress]} required={isProduct && euRepRequired}>
            {(a11y) => (
              <textarea
                {...a11y}
                rows={2}
                autoComplete="street-address"
                value={v(K.euRepAddress)}
                onChange={(e) => onChange(K.euRepAddress, e.target.value)}
                className={cn(complianceInputClass, complianceInputTone(Boolean(errors[K.euRepAddress])), "resize-y")}
              />
            )}
          </ComplianceField>
        </fieldset>
      ) : null}

      {isProduct ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {text(K.traceability, t("traceabilityLabel"), { hint: t("traceabilityHint"), required: false })}
          {text(K.notice, t("noticeLabel"), { hint: t("noticeHint"), required: false })}
          <ComplianceField id={id(K.safetyWarning)} label={t("safetyWarningLabel")} hint={t("safetyWarningHint")} error={errors[K.safetyWarning]}>
            {(a11y) => (
              <textarea
                {...a11y}
                rows={2}
                value={v(K.safetyWarning)}
                onChange={(e) => onChange(K.safetyWarning, e.target.value)}
                className={cn(complianceInputClass, complianceInputTone(false), "resize-y")}
              />
            )}
          </ComplianceField>
        </div>
      ) : null}

      {isProduct && profile && !manufacturerPrefill && !euRepPrefill ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          <Link href={profileHref} className="font-semibold text-violet-700 underline-offset-2 hover:underline dark:text-violet-300">
            {t("editProfile")}
          </Link>
        </p>
      ) : null}
    </div>
  )
}
