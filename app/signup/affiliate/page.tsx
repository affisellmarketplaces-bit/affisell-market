"use client"

import type { FormEvent } from "react"
import { useState } from "react"
import { signIn } from "next-auth/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"

import { credentialsSignInErrorMessage } from "@/lib/auth-portal-signin-messages"
import { LegalSignupConsent } from "@/components/legal/legal-signup-consent"

export default function AffiliateSignupPage() {
  const t = useTranslations("auth")
  const tSignup = useTranslations("auth.signupAffiliate")
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [socialHandle, setSocialHandle] = useState("")
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
    const handle = socialHandle.trim().replace(/^@/, "")
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        role: "AFFILIATE",
        name: handle || undefined,
        tiktok: handle || undefined,
        acceptTerms: true,
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
      callbackUrl: "/dashboard/affiliate",
    })
    setLoading(false)
    if (login?.error) {
      setError(credentialsSignInErrorMessage(login.code, t) ?? t("signupLoginFail"))
      return
    }
    router.push("/onboarding/affiliate")
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10 dark:bg-zinc-950">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-zinc-100">{tSignup("createTitle")}</h1>
          <p className="mt-2 text-gray-600 dark:text-zinc-400">{tSignup("subtitle")}</p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm dark:bg-zinc-900">
          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label htmlFor="affiliate-social" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-zinc-300">
                {tSignup("socialLabel")}
              </label>
              <input
                id="affiliate-social"
                type="text"
                required
                autoComplete="username"
                value={socialHandle}
                onChange={(e) => setSocialHandle(e.target.value)}
                placeholder={tSignup("socialPlaceholder")}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-violet-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>
            <div>
              <label htmlFor="affiliate-email" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-zinc-300">
                {t("email")}
              </label>
              <input
                id="affiliate-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-violet-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>
            <div>
              <label htmlFor="affiliate-password" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-zinc-300">
                {t("password")}
              </label>
              <input
                id="affiliate-password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-violet-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>
            <LegalSignupConsent
              role="AFFILIATE"
              termsChecked={termsChecked}
              privacyChecked={privacyChecked}
              onTermsChange={setTermsChecked}
              onPrivacyChange={setPrivacyChecked}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-violet-600 py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-violet-700 disabled:opacity-60"
            >
              {loading ? t("creating") : tSignup("createButton")}
            </button>
            {error ? <p className="text-center text-sm text-red-600 dark:text-red-400">{error}</p> : null}
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-gray-600 dark:text-zinc-400">
          {tSignup("hasAccount")}{" "}
          <Link href="/login/affiliate" className="font-medium text-violet-700 hover:underline dark:text-violet-300">
            {tSignup("signIn")}
          </Link>
        </p>
      </div>
    </div>
  )
}
