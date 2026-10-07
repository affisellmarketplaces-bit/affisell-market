"use client"

import { Loader2, ShieldCheck } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"

import { GpsrFields } from "@/components/supplier/listing-compliance/gpsr-fields"
import { resetComplianceProfileCache } from "@/components/supplier/listing-compliance/use-compliance-profile"
import { GPSR_KEYS } from "@/lib/listing-compliance/keys"
import {
  COMPLIANCE_PROFILE_FIELDS,
  type ComplianceProfile,
  type ComplianceProfileField,
} from "@/lib/listing-compliance/profile-shared"

/** Profile field ↔ the attribute key the same field uses on a product, so the product form's fields are reused as is. */
const KEY_OF: Record<ComplianceProfileField, string> = {
  manufacturerName: GPSR_KEYS.manufacturerName,
  manufacturerAddress: GPSR_KEYS.manufacturerAddress,
  manufacturerEmail: GPSR_KEYS.manufacturerEmail,
  manufacturerCountry: GPSR_KEYS.manufacturerCountry,
  euRepName: GPSR_KEYS.euRepName,
  euRepAddress: GPSR_KEYS.euRepAddress,
  euRepEmail: GPSR_KEYS.euRepEmail,
}

const toValues = (p: ComplianceProfile): Record<string, string> =>
  Object.fromEntries(COMPLIANCE_PROFILE_FIELDS.map((f) => [KEY_OF[f], p[f]]))
const toProfile = (values: Record<string, string>): ComplianceProfile =>
  Object.fromEntries(COMPLIANCE_PROFILE_FIELDS.map((f) => [f, values[KEY_OF[f]] ?? ""])) as ComplianceProfile

type Props = { initialProfile: ComplianceProfile; available: boolean }

/** Settings card: the supplier's reusable GPSR defaults (offered on each product with one click, never applied silently). */
export function SupplierComplianceProfileCard({ initialProfile, available }: Props) {
  const t = useTranslations("supplier.compliance")
  const [values, setValues] = useState(() => toValues(initialProfile))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  const onChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
    setErrors((prev) => (prev[key] ? { ...prev, [key]: "" } : prev))
  }

  async function save() {
    setBusy(true)
    setErrors({})
    try {
      const sent = toProfile(values)
      const res = await fetch("/api/supplier/compliance-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(sent),
      })
      if (res.ok) {
        const j = (await res.json()) as { profile: ComplianceProfile }
        // Show what the server stored (trimmed, country upper-cased) — but only for fields the visitor has not edited
        // since the request left: a slow response must never overwrite a newer keystroke.
        setValues((prev) => {
          const next = { ...prev }
          for (const f of COMPLIANCE_PROFILE_FIELDS) if (prev[KEY_OF[f]] === sent[f]) next[KEY_OF[f]] = j.profile[f]
          return next
        })
        setSaved(true)
        resetComplianceProfileCache()
        toast.success(t("profile.saved"))
        return
      }
      const j = (await res.json().catch(() => ({}))) as { error?: string; errors?: Partial<Record<ComplianceProfileField, string>> }
      if (res.status === 400 && j.errors) {
        const next: Record<string, string> = {}
        for (const [field, code] of Object.entries(j.errors)) {
          next[KEY_OF[field as ComplianceProfileField]] = t(`errors.${code}`)
        }
        setErrors(next)
        toast.error(t("profile.saveFailed"))
      } else {
        toast.error(res.status === 503 ? t("profile.unavailable") : t("profile.saveFailed"))
      }
    } catch {
      toast.error(t("profile.saveFailed"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-3xl border border-gray-100 bg-white/85 p-5 shadow-sm ring-1 ring-black/[0.02] sm:p-7 dark:border-zinc-800 dark:bg-zinc-950/75 dark:ring-white/[0.04]">
      <div className="flex items-start gap-3.5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-md shadow-violet-500/25">
          <ShieldCheck className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{t("profile.title")}</h1>
          <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{t("profile.intro")}</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{t("profile.manufacturerNote")}</p>
        </div>
      </div>

      {available ? null : (
        <p role="alert" className="mt-5 rounded-xl border border-amber-300/70 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100">
          {t("profile.unavailable")}
        </p>
      )}

      <form
        className="mt-6"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
        noValidate
      >
        <GpsrFields variant="profile" values={values} onChange={onChange} errors={errors} idPrefix="profile" />

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 focus-visible:ring-offset-2 disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {busy ? t("profile.saving") : t("profile.save")}
          </button>
          <span role="status" aria-live="polite" className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            {saved ? t("profile.saved") : ""}
          </span>
        </div>
      </form>
    </section>
  )
}
