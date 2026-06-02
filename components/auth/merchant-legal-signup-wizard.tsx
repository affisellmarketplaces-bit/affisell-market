"use client"

import type { FormEvent } from "react"
import { useMemo, useState } from "react"
import { signIn } from "next-auth/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { AnimatePresence, motion } from "framer-motion"
import {
  Briefcase,
  Building2,
  ChevronLeft,
  ChevronRight,
  Globe2,
  HeartHandshake,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react"

import { MerchantLegalDocumentSlot } from "@/components/auth/merchant-legal-document-slot"
import { LegalSignupConsent } from "@/components/legal/legal-signup-consent"
import { credentialsSignInErrorMessage } from "@/lib/auth-portal-signin-messages"
import {
  MERCHANT_LEGAL_STATUSES,
  MERCHANT_LEGAL_STATUS_CATALOG,
  allDocumentsForStatus,
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

type Props = {
  role: "SUPPLIER" | "AFFILIATE"
  accent: "emerald" | "violet"
  afterLoginPath: string
  inviteToken?: string | null
  inviteBanner?: string | null
  defaultSocialHandle?: boolean
}

const STEPS = ["status", "identity", "documents", "account"] as const
type Step = (typeof STEPS)[number]

const ERROR_KEYS: Record<string, string> = {
  signup_draft_required: "errDraft",
  invalid_legal_status: "errStatus",
  legal_entity_name_required: "errEntityName",
  siret_required: "errSiret",
  rna_required: "errRna",
  upload_failed: "errUpload",
  file_size_invalid: "errFileSize",
  file_type_invalid: "errFileType",
}

export function MerchantLegalSignupWizard({
  role,
  accent,
  afterLoginPath,
  inviteToken,
  inviteBanner,
  defaultSocialHandle = false,
}: Props) {
  const t = useTranslations("auth")
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

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [socialHandle, setSocialHandle] = useState("")
  const [termsChecked, setTermsChecked] = useState(false)
  const [privacyChecked, setPrivacyChecked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const meta = legalStatus ? MERCHANT_LEGAL_STATUS_CATALOG[legalStatus] : null
  const docList = legalStatus ? allDocumentsForStatus(legalStatus) : []
  const stepIndex = STEPS.indexOf(step)

  const shellGradient =
    accent === "emerald"
      ? "from-emerald-950 via-zinc-950 to-teal-950"
      : "from-violet-950 via-zinc-950 to-fuchsia-950"

  function resolveError(code: string): string {
    if (code.startsWith("missing_document:")) {
      return tLegal("errMissingDoc")
    }
    const key = ERROR_KEYS[code]
    return key ? tLegal(key) : code
  }

  function canAdvanceFromIdentity(): boolean {
    if (!meta) return false
    if (meta.fields.includes("legalEntityName") && !legalEntityName.trim()) return false
    if (meta.fields.includes("siret") && siret.replace(/\D/g, "").length !== 14) return false
    if (meta.fields.includes("rnaNumber") && rnaNumber.trim().length < 8) return false
    return true
  }

  function canAdvanceFromDocuments(): boolean {
    if (!legalStatus) return false
    for (const d of docList) {
      if (!d.required) continue
      if (role === "AFFILIATE" && legalStatus === "PARTICULIER" && d.type === "PROOF_OF_ADDRESS") {
        continue
      }
      if (!uploads[d.type]) return false
    }
    return true
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!legalStatus || !termsChecked || !privacyChecked) return
    setLoading(true)
    setError(null)

    const handle = socialHandle.trim().replace(/^@/, "")
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        role,
        name: (defaultSocialHandle ? handle : legalEntityName.trim()) || undefined,
        tiktok: defaultSocialHandle && handle ? handle : undefined,
        signupDraftId: draftId,
        legalStatus,
        legalEntityName: legalEntityName.trim() || undefined,
        tradeName: tradeName.trim() || undefined,
        siret: siret.trim() || undefined,
        vatNumber: vatNumber.trim() || undefined,
        rnaNumber: rnaNumber.trim() || undefined,
        acceptTerms: true,
        acceptPrivacy: true,
        ...(inviteToken ? { inviteToken } : {}),
      }),
    })
    const data = (await res.json()) as { error?: string }
    if (!res.ok) {
      setLoading(false)
      setError(resolveError(data.error ?? t("signupFail")))
      return
    }

    const login = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: afterLoginPath,
    })
    setLoading(false)
    if (login?.error) {
      setError(credentialsSignInErrorMessage(login.code, t) ?? t("signupLoginFail"))
      return
    }
    router.push(afterLoginPath)
  }

  return (
    <div className={cn("min-h-screen bg-gradient-to-br px-4 py-10", shellGradient)}>
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8 text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-100/90">
            <ShieldCheck className="size-3.5" aria-hidden />
            {tLegal("badge")}
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {role === "SUPPLIER" ? tLegal("titleSupplier") : tLegal("titleAffiliate")}
          </h1>
          <p className="mt-2 text-sm text-violet-100/80">{tLegal("subtitle")}</p>
          {inviteBanner ? (
            <p className="mx-auto mt-4 max-w-md rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
              {inviteBanner}
            </p>
          ) : null}
        </div>

        <div className="mb-6 flex justify-center gap-2">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={cn(
                "h-1.5 flex-1 max-w-[4.5rem] rounded-full transition",
                i <= stepIndex ? "bg-white/90" : "bg-white/15"
              )}
              aria-hidden
            />
          ))}
        </div>

        <div className="overflow-hidden rounded-3xl border border-white/15 bg-white/5 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
          <AnimatePresence mode="wait">
            {step === "status" ? (
              <motion.div
                key="status"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="space-y-4"
              >
                <h2 className="text-lg font-semibold text-white">{tLegal("stepStatus")}</h2>
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
                            "flex w-full flex-col items-start gap-2 rounded-2xl border p-4 text-left transition",
                            selected
                              ? "border-white/50 bg-white/15 ring-2 ring-white/30"
                              : "border-white/10 bg-black/20 hover:border-white/25"
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
                          <span className="text-sm font-bold text-white">{tLegal(item.titleKey)}</span>
                          <span className="text-[11px] leading-snug text-violet-100/75">
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
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-semibold text-violet-950 disabled:opacity-50"
                >
                  {tLegal("continue")}
                  <ChevronRight className="size-4" aria-hidden />
                </button>
              </motion.div>
            ) : null}

            {step === "identity" && meta ? (
              <motion.div
                key="identity"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="space-y-4"
              >
                <h2 className="text-lg font-semibold text-white">{tLegal("stepIdentity")}</h2>
                {meta.fields.includes("legalEntityName") ? (
                  <Field
                    id="legal-entity"
                    label={tLegal("fieldLegalName")}
                    value={legalEntityName}
                    onChange={setLegalEntityName}
                    required
                  />
                ) : null}
                {meta.fields.includes("tradeName") ? (
                  <Field
                    id="trade-name"
                    label={tLegal("fieldTradeName")}
                    value={tradeName}
                    onChange={setTradeName}
                  />
                ) : null}
                {meta.fields.includes("siret") ? (
                  <Field
                    id="siret"
                    label="SIRET"
                    value={siret}
                    onChange={(v) => setSiret(v.replace(/\D/g, "").slice(0, 14))}
                    inputMode="numeric"
                    required
                  />
                ) : null}
                {meta.fields.includes("vatNumber") ? (
                  <Field id="vat" label={tLegal("fieldVat")} value={vatNumber} onChange={setVatNumber} />
                ) : null}
                {meta.fields.includes("rnaNumber") ? (
                  <Field id="rna" label={tLegal("fieldRna")} value={rnaNumber} onChange={setRnaNumber} required />
                ) : null}
                <NavRow
                  onBack={() => setStep("status")}
                  onNext={() => setStep("documents")}
                  nextDisabled={!canAdvanceFromIdentity()}
                  backLabel={tLegal("back")}
                  nextLabel={tLegal("continue")}
                />
              </motion.div>
            ) : null}

            {step === "documents" && legalStatus ? (
              <motion.div
                key="documents"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="space-y-4"
              >
                <h2 className="text-lg font-semibold text-white">{tLegal("stepDocuments")}</h2>
                <p className="text-xs text-violet-100/70">{tLegal("documentsHint")}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {docList.map((d) => {
                    const skip =
                      role === "AFFILIATE" && legalStatus === "PARTICULIER" && d.type === "PROOF_OF_ADDRESS"
                    if (skip) return null
                    return (
                      <MerchantLegalDocumentSlot
                        key={d.type}
                        draftId={draftId}
                        documentType={d.type}
                        label={tLegal(d.hintKey)}
                        hint={d.required ? tLegal("required") : tLegal("optional")}
                        required={d.required}
                        uploadedUrl={uploads[d.type] ?? null}
                        onUploaded={(url) =>
                          setUploads((prev) => ({ ...prev, [d.type]: url }))
                        }
                        onError={(msg) => setUploadError(resolveError(msg))}
                      />
                    )
                  })}
                </div>
                {uploadError ? <p className="text-sm text-rose-300">{uploadError}</p> : null}
                <NavRow
                  onBack={() => setStep("identity")}
                  onNext={() => setStep("account")}
                  nextDisabled={!canAdvanceFromDocuments()}
                  backLabel={tLegal("back")}
                  nextLabel={tLegal("continue")}
                />
              </motion.div>
            ) : null}

            {step === "account" ? (
              <motion.form
                key="account"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                onSubmit={onSubmit}
                className="space-y-4"
              >
                <h2 className="text-lg font-semibold text-white">{tLegal("stepAccount")}</h2>
                {defaultSocialHandle ? (
                  <Field
                    id="social"
                    label={tLegal("fieldSocial")}
                    value={socialHandle}
                    onChange={setSocialHandle}
                    placeholder="@votre_pseudo"
                  />
                ) : null}
                <Field
                  id="email"
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  required
                  autoComplete="email"
                />
                <Field
                  id="password"
                  label={tLegal("fieldPassword")}
                  type="password"
                  value={password}
                  onChange={setPassword}
                  required
                  autoComplete="new-password"
                />
                <LegalSignupConsent
                  role={role}
                  termsChecked={termsChecked}
                  privacyChecked={privacyChecked}
                  onTermsChange={setTermsChecked}
                  onPrivacyChange={setPrivacyChecked}
                />
                {role === "SUPPLIER" ? (
                  <p className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                    {tLegal("vatNotice")}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={loading || !termsChecked || !privacyChecked}
                  className={cn(
                    "w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-60",
                    accent === "emerald" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-violet-600 hover:bg-violet-500"
                  )}
                >
                  {loading ? t("creating") : tLegal("submit")}
                </button>
                {error ? <p className="text-center text-sm text-rose-300">{error}</p> : null}
                <NavRow
                  onBack={() => setStep("documents")}
                  backLabel={tLegal("back")}
                  hideNext
                />
              </motion.form>
            ) : null}
          </AnimatePresence>
        </div>

        <p className="mt-6 text-center text-sm text-violet-100/70">
          {role === "SUPPLIER" ? (
            <>
              {tLegal("hasAccountSupplier")}{" "}
              <Link href="/login/supplier" className="font-medium text-white underline-offset-2 hover:underline">
                {tLegal("signIn")}
              </Link>
            </>
          ) : (
            <>
              {tLegal("hasAccountAffiliate")}{" "}
              <Link href="/login/affiliate" className="font-medium text-white underline-offset-2 hover:underline">
                {tLegal("signIn")}
              </Link>
            </>
          )}
        </p>
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
  autoComplete,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
  inputMode?: "numeric" | "text" | "email"
  placeholder?: string
  autoComplete?: string
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-violet-100">
        {label}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        inputMode={inputMode}
        placeholder={placeholder}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/20 bg-black/30 px-4 py-2.5 text-white outline-none transition focus:border-violet-300/60 focus:ring-2 focus:ring-violet-500/30"
      />
    </div>
  )
}

function NavRow({
  onBack,
  onNext,
  backLabel,
  nextLabel,
  nextDisabled,
  hideNext,
}: {
  onBack: () => void
  onNext?: () => void
  backLabel: string
  nextLabel?: string
  nextDisabled?: boolean
  hideNext?: boolean
}) {
  return (
    <div className="flex gap-2 pt-2">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-white/20 py-2.5 text-sm font-medium text-violet-100"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {backLabel}
      </button>
      {!hideNext && onNext ? (
        <button
          type="button"
          disabled={nextDisabled}
          onClick={onNext}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-white/90 py-2.5 text-sm font-semibold text-violet-950 disabled:opacity-50"
        >
          {nextLabel}
          <ChevronRight className="size-4" aria-hidden />
        </button>
      ) : null}
    </div>
  )
}
