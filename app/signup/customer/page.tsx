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
  const t = useTranslations("auth")
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
  const [termsChecked, setTermsChecked] = useState(false)
  const [privacyChecked, setPrivacyChecked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!termsChecked || !privacyChecked) {
      setError("Veuillez accepter les conditions et la politique de confidentialité.")
      return
    }
    setLoading(true)
    setError(null)
    if (buyerType === "PROFESSIONAL" && siret.replace(/\D/g, "").length !== 14) {
      setError("SIRET à 14 chiffres requis pour un compte professionnel.")
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
        acceptTerms: true,
        acceptPrivacy: true,
      }),
    })
    const data = (await res.json()) as { error?: string }
    if (!res.ok) {
      setLoading(false)
      setError(data.error ?? "Signup failed")
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
      setError(credentialsSignInErrorMessage(login.code, t) ?? t("signupLoginFail"))
    } else {
      router.push(returnTo)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Shop & Get Up to 20% Back</h1>
          <p className="mt-2 text-gray-600">Get up to 20% cashback on every purchase</p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">Type de compte</p>
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
                  Particulier
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
                  Professionnel
                </button>
              </div>
            </div>
            {buyerType === "PROFESSIONAL" ? (
              <>
                <div>
                  <label htmlFor="customer-company" className="mb-1.5 block text-sm font-medium text-gray-700">
                    Raison sociale
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
                    SIRET
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
                Email
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
                Password
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
              termsChecked={termsChecked}
              privacyChecked={privacyChecked}
              onTermsChange={setTermsChecked}
              onPrivacyChange={setPrivacyChecked}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
            {error ? <p className="text-center text-sm text-red-600">{error}</p> : null}
          </form>

          <div className="mt-6 border-t border-gray-100 pt-6">
            <div className="space-y-2.5 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓</span> Up to 20% cashback credited instantly
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓</span> Bonus credits for reviews & referrals
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓</span> Support creators you love
              </div>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link
            href={
              shopSlug
                ? `/shops/${shopSlug}/login?callbackUrl=${encodeURIComponent(returnTo)}`
                : loginCustomerPath(returnTo)
            }
            className="font-medium text-blue-600 hover:text-blue-700"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function CustomerSignupPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Chargement…</div>}>
      <CustomerSignupForm />
    </Suspense>
  )
}
