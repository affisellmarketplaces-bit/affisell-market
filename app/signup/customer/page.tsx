"use client"

import type { FormEvent } from "react"
import { Suspense, useState } from "react"
import { signIn } from "next-auth/react"

import { useTranslations } from "next-intl"

import { credentialsSignInErrorMessage } from "@/lib/auth-portal-signin-messages"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"

import { sanitizeInternalCallbackUrl } from "@/lib/auth-login-portal"
import { loginCustomerPath } from "@/lib/login-redirect"
import { LegalSignupConsent } from "@/components/legal/legal-signup-consent"

function CustomerSignupForm() {
  const t = useTranslations("auth.customerSignup")
  const tAuth = useTranslations("auth")
  const router = useRouter()
  const search = useSearchParams()
  const shopSlug = search.get("shop")?.trim() || null
  const rawCallback = search.get("callbackUrl")
  const returnTo = sanitizeInternalCallbackUrl(rawCallback) ?? (shopSlug ? `/shops/${shopSlug}` : "/marketplace/account")
  const [buyerType, setBuyerType] = useState<"INDIVIDUAL" | "PROFESSIONAL">("INDIVIDUAL")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [siret, setSiret] = useState("")
  const [cguChecked, setCguChecked] = useState(false)
  const [privacyChecked, setPrivacyChecked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!cguChecked || !privacyChecked) {
      setError(t("acceptTermsError"))
      return
    }
    setLoading(true)
    setError(null)
    if (buyerType === "PROFESSIONAL" && siret.replace(/\D/g, "").length !== 14) {
      setError(t("siretError"))
      setLoading(false)
      return
    }
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        role: "CUSTOMER",
        buyerAccountType: buyerType,
        name: buyerType === "PROFESSIONAL" ? companyName.trim() || undefined : undefined,
        siret: buyerType === "PROFESSIONAL" ? siret : undefined,
        acceptCgu: true,
        acceptPrivacy: true,
      }),
    })
    const data = (await res.json()) as { error?: string }
    if (!res.ok) {
      setLoading(false)
      setError(data.error ?? t("signupFail"))
      return
    }
    const login = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: returnTo,
    })
    setLoading(false)
    if (login?.error) {
      setError(credentialsSignInErrorMessage(login.code, tAuth) ?? tAuth("signupLoginFail"))
    } else {
      router.push(returnTo)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">{t("heroTitle")}</h1>
          <p className="mt-2 text-gray-600">{t("heroSubtitle")}</p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">{t("accountTypeLabel")}</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBuyerType("INDIVIDUAL")}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                    buyerType === "INDIVIDUAL"
                      ? "border-blue-600 bg-blue-50 text-blue-900"
                      : "border-gray-200 text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {t("individual")}
                </button>
                <button
                  type="button"
                  onClick={() => setBuyerType("PROFESSIONAL")}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                    buyerType === "PROFESSIONAL"
                      ? "border-blue-600 bg-blue-50 text-blue-900"
                      : "border-gray-200 text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {t("professional")}
                </button>
              </div>
            </div>
            {buyerType === "PROFESSIONAL" ? (
              <>
                <div>
                  <label htmlFor="customer-company" className="mb-1.5 block text-sm font-medium text-gray-700">
                    {t("companyName")}
                  </label>
                  <input
                    id="customer-company"
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label htmlFor="customer-siret" className="mb-1.5 block text-sm font-medium text-gray-700">
                    {t("siret")}
                  </label>
                  <input
                    id="customer-siret"
                    type="text"
                    required
                    inputMode="numeric"
                    value={siret}
                    onChange={(e) => setSiret(e.target.value.replace(/\D/g, "").slice(0, 14))}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </>
            ) : null}
            <div>
              <label htmlFor="customer-email" className="mb-1.5 block text-sm font-medium text-gray-700">
                {t("email")}
              </label>
              <input
                id="customer-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label htmlFor="customer-password" className="mb-1.5 block text-sm font-medium text-gray-700">
                {t("password")}
              </label>
              <input
                id="customer-password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <LegalSignupConsent
              role="CUSTOMER"
              cguChecked={cguChecked}
              privacyChecked={privacyChecked}
              onCguChange={setCguChecked}
              onPrivacyChange={setPrivacyChecked}
            />
            <button
              type="submit"
              disabled={loading || !cguChecked || !privacyChecked}
              className="w-full rounded-xl bg-blue-600 py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? t("submitLoading") : t("submit")}
            </button>
            {error ? <p className="text-center text-sm text-red-600">{error}</p> : null}
          </form>

          <div className="mt-6 border-t border-gray-100 pt-6">
            <div className="space-y-2.5 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓</span> {t("benefitCashback")}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓</span> {t("benefitReviews")}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓</span> {t("benefitCreators")}
              </div>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-gray-600">
          {t("alreadyAccount")}{" "}
          <Link
            href={
              shopSlug
                ? `/shops/${shopSlug}/login?callbackUrl=${encodeURIComponent(returnTo)}`
                : loginCustomerPath(returnTo)
            }
            className="font-medium text-blue-600 hover:text-blue-700"
          >
            {t("signIn")}
          </Link>
        </p>
      </div>
    </div>
  )
}

function CustomerSignupLoading() {
  const t = useTranslations("auth")
  return (
    <div className="flex min-h-screen items-center justify-center">{t("loading")}</div>
  )
}

export default function CustomerSignupPage() {
  return (
    <Suspense fallback={<CustomerSignupLoading />}>
      <CustomerSignupForm />
    </Suspense>
  )
}
