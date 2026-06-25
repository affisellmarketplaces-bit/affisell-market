"use client"

import type { FormEvent, HTMLAttributes } from "react"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  Briefcase,
  Building2,
  ChevronLeft,
  ChevronRight,
  Globe2,
  HeartHandshake,
  Loader2,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react"

import { MerchantLegalDocumentSlot } from "@/components/auth/merchant-legal-document-slot"
import { buttonVariants } from "@/components/ui/button"
import {
  MERCHANT_LEGAL_STATUSES,
  MERCHANT_LEGAL_STATUS_CATALOG,
  documentsForSignup,
  signupFieldsForStatus,
  type MerchantDocumentType,
  type MerchantLegalStatus,
} from "@/lib/merchant-legal/merchant-legal-status-shared"
import { createSignupDraftId } from "@/lib/signup-draft-id"
import { cn } from "@/lib/utils"

const STATUS_ICONS = {
  user: UserRound,
  sparkles: Sparkles,
  briefcase: Briefcase,
  building: Building2,
  "heart-handshake": HeartHandshake,
  globe: Globe2,
} as const

const STEPS = ["status", "identity", "documents"] as const
type Step = (typeof STEPS)[number]

const ERROR_KEYS: Record<string, string> = {
  signup_draft_required: "errDraft",
  invalid_legal_status: "errStatus",
  legal_entity_name_required: "errEntityName",
  siret_required: "errSiret",
  rna_required: "errRna",
  profile_exists: "errProfileExists",
}

type Props = {
  role: "SUPPLIER" | "AFFILIATE"
}

export function MerchantLegalProfileSubmitForm({ role }: Props) {
  const tLegal = useTranslations("auth.merchantLegal")
  const router = useRouter()
  const draftId = useMemo(() => createSignupDraftId(), [])

  const [step, setStep] = useState<Step>("status")
  const [legalStatus, setLegalStatus] = useState<MerchantLegalStatus | null>(null)
  const [legalEntityName, setLegalEntityName] = useState("")
  const [tradeName, setTradeName] = useState("")
  const [siret, setSiret] = useState("")
  const [vatNumber, setVatNumber] = useState("")
  const [rnaNumber, setRnaNumber] = useState("")
  const [uploads, setUploads] = useState<Partial<Record<MerchantDocumentType, string>>>({})
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const meta = legalStatus ? MERCHANT_LEGAL_STATUS_CATALOG[legalStatus] : null
  const signupFields = legalStatus ? signupFieldsForStatus(legalStatus, role) : []
  const docList = legalStatus ? documentsForSignup(legalStatus, role) : []
  const stepIndex = STEPS.indexOf(step)

  function resolveError(code: string): string {
    if (code.startsWith("missing_document:")) {
      return tLegal("errMissingDoc")
    }
    const key = ERROR_KEYS[code]
    return key ? tLegal(key) : code
  }

  function canAdvanceFromIdentity(): boolean {
    if (!meta) return false
    if (signupFields.includes("legalEntityName") && !legalEntityName.trim()) return false
    if (signupFields.includes("siret") && siret.replace(/\D/g, "").length !== 14) return false
    if (signupFields.includes("rnaNumber") && rnaNumber.trim().length < 8) return false
    return true
  }

  function canSubmitDocuments(): boolean {
    if (!legalStatus) return false
    for (const d of docList) {
      if (!d.required) continue
      if (!uploads[d.type]) return false
    }
    return true
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!legalStatus || !canSubmitDocuments()) return
    setLoading(true)
    setError(null)

    const res = await fetch("/api/merchant/legal-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signupDraftId: draftId,
        legalStatus,
        legalEntityName: legalEntityName.trim() || undefined,
        tradeName: tradeName.trim() || undefined,
        siret: siret.trim() || undefined,
        vatNumber: vatNumber.trim() || undefined,
        rnaNumber: rnaNumber.trim() || undefined,
        countryCode: "FR",
      }),
    })
    const data = (await res.json()) as { error?: string }
    setLoading(false)

    if (!res.ok) {
      setError(resolveError(data.error ?? "submit_failed"))
      return
    }

    router.push("/dashboard/verification")
    router.refresh()
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex justify-center gap-2">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={cn(
              "h-1.5 flex-1 max-w-[5rem] rounded-full transition",
              i <= stepIndex ? "bg-violet-600" : "bg-violet-200 dark:bg-violet-900"
            )}
            aria-hidden
          />
        ))}
      </div>

      <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-6">
        {step === "status" ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{tLegal("stepStatus")}</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {MERCHANT_LEGAL_STATUSES.map((status) => {
                const item = MERCHANT_LEGAL_STATUS_CATALOG[status]
                const Icon = STATUS_ICONS[item.icon]
                const selected = legalStatus === status
                return (
                  <li key={status}>
                    <button
                      type="button"
                      onClick={() => setLegalStatus(status)}
                      className={cn(
                        "flex w-full flex-col items-start gap-2 rounded-xl border p-4 text-left transition",
                        selected
                          ? "border-violet-400 bg-violet-50 ring-2 ring-violet-200 dark:border-violet-600 dark:bg-violet-950/40 dark:ring-violet-900"
                          : "border-zinc-200 bg-zinc-50 hover:border-violet-300 dark:border-zinc-800 dark:bg-zinc-900/50"
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-9 items-center justify-center rounded-xl bg-gradient-to-br text-white",
                          item.accentClass
                        )}
                      >
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <span className="text-sm font-bold text-zinc-900 dark:text-white">{tLegal(item.titleKey)}</span>
                      <span className="text-[11px] leading-snug text-zinc-600 dark:text-zinc-400">
                        {tLegal(item.subtitleKey)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            <button
              type="button"
              disabled={!legalStatus}
              onClick={() => setStep("identity")}
              className={cn(buttonVariants(), "w-full gap-2")}
            >
              {tLegal("continue")}
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
        ) : null}

        {step === "identity" && meta ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{tLegal("stepIdentity")}</h2>
            {signupFields.includes("legalEntityName") ? (
              <Field
                id="legal-entity"
                label={tLegal("fieldLegalName")}
                value={legalEntityName}
                onChange={setLegalEntityName}
                required
              />
            ) : null}
            {signupFields.includes("tradeName") ? (
              <Field id="trade-name" label={tLegal("fieldTradeName")} value={tradeName} onChange={setTradeName} />
            ) : null}
            {signupFields.includes("siret") ? (
              <Field
                id="siret"
                label="SIRET"
                value={siret}
                onChange={(v) => setSiret(v.replace(/\D/g, "").slice(0, 14))}
                inputMode="numeric"
                required
              />
            ) : null}
            {signupFields.includes("vatNumber") ? (
              <Field id="vat" label={tLegal("fieldVat")} value={vatNumber} onChange={setVatNumber} />
            ) : null}
            {signupFields.includes("rnaNumber") ? (
              <Field id="rna" label={tLegal("fieldRna")} value={rnaNumber} onChange={setRnaNumber} required />
            ) : null}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep("status")}
                className={cn(buttonVariants({ variant: "outline" }), "flex-1 gap-1")}
              >
                <ChevronLeft className="size-4" aria-hidden />
                {tLegal("back")}
              </button>
              <button
                type="button"
                disabled={!canAdvanceFromIdentity()}
                onClick={() => setStep("documents")}
                className={cn(buttonVariants(), "flex-1 gap-1")}
              >
                {tLegal("continue")}
                <ChevronRight className="size-4" aria-hidden />
              </button>
            </div>
          </div>
        ) : null}

        {step === "documents" && legalStatus ? (
          <form onSubmit={onSubmit} className="space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{tLegal("stepDocuments")}</h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">{tLegal("documentsHint")}</p>
            <div className="rounded-xl bg-gradient-to-br from-violet-950 via-zinc-950 to-fuchsia-950 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {docList.map((d) => (
                    <MerchantLegalDocumentSlot
                      key={d.type}
                      draftId={draftId}
                      documentType={d.type}
                      label={tLegal(d.hintKey)}
                      hint={d.required ? tLegal("required") : tLegal("optional")}
                      required={d.required}
                      uploadedUrl={uploads[d.type] ?? null}
                      onUploaded={(url) => setUploads((prev) => ({ ...prev, [d.type]: url }))}
                      onError={(msg) => setUploadError(resolveError(msg))}
                    />
                ))}
              </div>
            </div>
            {uploadError ? <p className="text-sm text-rose-600 dark:text-rose-400">{uploadError}</p> : null}
            {error ? <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}
            {role === "SUPPLIER" ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                {role === "AFFILIATE" ? tLegal("vatNoticeAffiliate") : tLegal("vatNotice")}
              </p>
            ) : null}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep("identity")}
                className={cn(buttonVariants({ variant: "outline" }), "flex-1 gap-1")}
              >
                <ChevronLeft className="size-4" aria-hidden />
                {tLegal("back")}
              </button>
              <button
                type="submit"
                disabled={loading || !canSubmitDocuments()}
                className={cn(buttonVariants(), "flex-1 gap-2 bg-violet-600 hover:bg-violet-700")}
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    {tLegal("submit")}
                  </>
                ) : (
                  <>
                    <ShieldCheck className="size-4" aria-hidden />
                    {tLegal("submit")}
                  </>
                )}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  )
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  required,
  inputMode,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"]
  placeholder?: string
}) {
  return (
    <label htmlFor={id} className="block space-y-1.5">
      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{label}</span>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        inputMode={inputMode}
        placeholder={placeholder}
        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm outline-none ring-violet-500/0 transition focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
      />
    </label>
  )
}
