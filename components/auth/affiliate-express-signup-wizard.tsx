"use client"

import type { FormEvent } from "react"
import { useState } from "react"
import { signIn } from "next-auth/react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowRight,
  PackageX,
  Rocket,
  ShieldCheck,
  Sparkles,
  Truck,
  Zap,
} from "lucide-react"

import { LegalSignupConsent } from "@/components/legal/legal-signup-consent"
import { credentialsSignInErrorMessage } from "@/lib/auth-portal-signin-messages"
import { cn } from "@/lib/utils"

type Props = {
  afterLoginPath: string
}

type Step = "profile" | "account"

const TRUST_PILLS = [
  { icon: PackageX, key: "noStock" as const },
  { icon: Truck, key: "noShipping" as const },
  { icon: ShieldCheck, key: "verifyLater" as const },
] as const

export function AffiliateExpressSignupWizard({ afterLoginPath }: Props) {
  const t = useTranslations("auth")
  const tExpress = useTranslations("auth.affiliateExpress")

  const [step, setStep] = useState<Step>("profile")
  const [displayName, setDisplayName] = useState("")
  const [socialHandle, setSocialHandle] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [cguChecked, setCguChecked] = useState(false)
  const [roleTermsChecked, setRoleTermsChecked] = useState(false)
  const [privacyChecked, setPrivacyChecked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const profileReady = displayName.trim().length >= 2 || socialHandle.trim().length >= 2

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!cguChecked || !roleTermsChecked || !privacyChecked) return
    setLoading(true)
    setError(null)

    const handle = socialHandle.trim().replace(/^@/, "")
    const signupPayload = {
      email,
      password,
      role: "AFFILIATE",
      affiliateExpress: true,
      name: (handle || displayName.trim()).slice(0, 120),
      tiktok: handle || undefined,
      acceptCgu: true,
      acceptRoleTerms: true,
      acceptPrivacy: true,
    }

    try {
      const controller = new AbortController()
      const timeoutId = window.setTimeout(() => controller.abort(), 30_000)
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(signupPayload),
        signal: controller.signal,
      })
      window.clearTimeout(timeoutId)

      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? t("signupFail"))
        setLoading(false)
        return
      }

      const login = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: afterLoginPath,
      })
      if (login?.error) {
        setError(credentialsSignInErrorMessage(login.code, t) ?? t("signupLoginFail"))
        setLoading(false)
        return
      }
      window.location.assign(afterLoginPath)
    } catch (err) {
      console.log("[affiliate-express-signup]", {
        result: "submit_failed",
        error: err instanceof Error ? err.message : String(err),
      })
      setError(t("signupFail"))
      setLoading(false)
    }
  }

  return (
    <div className="affisell-reseller-express-bg min-h-screen bg-gradient-to-br from-violet-950 via-zinc-950 to-fuchsia-950 px-4 py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="affisell-reseller-express-aurora absolute inset-x-0 top-0 h-64 opacity-70" />
      </div>

      <div className="relative mx-auto w-full max-w-xl">
        <div className="mb-8 text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-violet-300/25 bg-violet-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-100/90">
            <Sparkles className="size-3.5" aria-hidden />
            {tExpress("badge")}
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {tExpress("title")}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-violet-100/80">
            {tExpress("subtitle")}
          </p>
        </div>

        <ul className="mb-6 flex flex-wrap justify-center gap-2">
          {TRUST_PILLS.map(({ icon: Icon, key }) => (
            <li
              key={key}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-violet-50/90 backdrop-blur-sm"
            >
              <Icon className="size-3.5 shrink-0 text-emerald-300" aria-hidden />
              {tExpress(`trust.${key}`)}
            </li>
          ))}
        </ul>

        <div className="mb-5 flex justify-center gap-2">
          {(["profile", "account"] as const).map((s, i) => (
            <div
              key={s}
              className={cn(
                "h-1.5 w-16 rounded-full transition",
                (step === "account" && s === "profile") || step === s ? "bg-white/90" : "bg-white/15"
              )}
              aria-hidden
            />
          ))}
        </div>

        <div className="overflow-hidden rounded-3xl border border-white/15 bg-white/5 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
          <AnimatePresence mode="wait">
            {step === "profile" ? (
              <motion.div
                key="profile"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 text-violet-100">
                  <Rocket className="size-5 text-fuchsia-300" aria-hidden />
                  <h2 className="text-lg font-semibold text-white">{tExpress("stepProfile")}</h2>
                </div>
                <p className="text-xs leading-relaxed text-violet-100/70">{tExpress("stepProfileHint")}</p>
                <Field
                  id="display-name"
                  label={tExpress("fieldDisplayName")}
                  value={displayName}
                  onChange={setDisplayName}
                  placeholder={tExpress("fieldDisplayNamePlaceholder")}
                />
                <Field
                  id="social"
                  label={tExpress("fieldSocial")}
                  value={socialHandle}
                  onChange={setSocialHandle}
                  placeholder="@your_handle"
                />
                <button
                  type="button"
                  disabled={!profileReady}
                  onClick={() => setStep("account")}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-semibold text-violet-950 disabled:opacity-50"
                >
                  {tExpress("continue")}
                  <ArrowRight className="size-4" aria-hidden />
                </button>
              </motion.div>
            ) : (
              <motion.form
                key="account"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                onSubmit={onSubmit}
                className="space-y-4"
              >
                <div className="flex items-center gap-2">
                  <Zap className="size-5 text-amber-300" aria-hidden />
                  <h2 className="text-lg font-semibold text-white">{tExpress("stepAccount")}</h2>
                </div>
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
                  label={tExpress("fieldPassword")}
                  type="password"
                  value={password}
                  onChange={setPassword}
                  required
                  autoComplete="new-password"
                />
                <LegalSignupConsent
                  role="AFFILIATE"
                  cguChecked={cguChecked}
                  roleTermsChecked={roleTermsChecked}
                  privacyChecked={privacyChecked}
                  onCguChange={setCguChecked}
                  onRoleTermsChange={setRoleTermsChecked}
                  onPrivacyChange={setPrivacyChecked}
                />
                <p className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2.5 text-xs leading-relaxed text-emerald-50/95">
                  {tExpress("kycDeferredNote")}
                </p>
                <button
                  type="submit"
                  disabled={loading || !cguChecked || !roleTermsChecked || !privacyChecked}
                  className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-60"
                >
                  {loading ? t("creating") : tExpress("submit")}
                </button>
                {error ? <p className="text-center text-sm text-rose-300">{error}</p> : null}
                <button
                  type="button"
                  onClick={() => setStep("profile")}
                  className="w-full text-center text-xs text-violet-200/80 hover:text-white"
                >
                  ← {tExpress("back")}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        <p className="mt-6 text-center text-sm text-violet-100/70">
          {tExpress("hasAccount")}{" "}
          <Link href="/login/affiliate" className="font-medium text-white underline-offset-2 hover:underline">
            {tExpress("signIn")}
          </Link>
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
  placeholder,
  autoComplete,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
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
        placeholder={placeholder}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/20 bg-black/30 px-4 py-2.5 text-white outline-none transition placeholder:text-violet-200/40 focus:border-violet-300/60 focus:ring-2 focus:ring-violet-500/30"
      />
    </div>
  )
}
