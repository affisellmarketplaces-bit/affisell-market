"use client"

import type { FormEvent } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"

import { forgotPasswordHref } from "@/lib/auth-forgot-password-href"
import { credentialsSignInErrorMessage } from "@/lib/auth-portal-signin-messages"
import { sanitizeInternalCallbackUrl } from "@/lib/auth-login-portal"
import {
  MARKETPLACE_BUYER_ORDERS_PATH,
  signupCustomerPath,
} from "@/lib/login-redirect"

type Props = {
  mode: "login" | "signup"
  defaultCallback?: string
}

export function MarketplaceBuyerAuthForm({
  mode,
  defaultCallback = MARKETPLACE_BUYER_ORDERS_PATH,
}: Props) {
  const t = useTranslations("auth")
  const tBuyer = useTranslations("auth.marketplaceBuyer")
  const search = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rawCallback = search.get("callbackUrl")
  const safeCallback = sanitizeInternalCallbackUrl(rawCallback)
  const returnTo = safeCallback ?? defaultCallback

  const signupHref = useMemo(() => signupCustomerPath(returnTo), [returnTo])
  const loginHref = useMemo(() => {
    const u = new URLSearchParams()
    u.set("callbackUrl", returnTo)
    return `/login/customer?${u.toString()}`
  }, [returnTo])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (mode === "signup") {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          role: "CUSTOMER",
          acceptTerms: true,
          acceptPrivacy: true,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setLoading(false)
        setError(data.error ?? tBuyer("signupFail"))
        return
      }
    }

    const res = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
      callbackUrl: returnTo,
    })
    setLoading(false)
    if (res?.ok) {
      window.location.assign(returnTo)
      return
    }
    setError(credentialsSignInErrorMessage(res?.code, res?.error, t) ?? t("invalidCredentials"))
  }

  const title = mode === "login" ? tBuyer("loginTitle") : tBuyer("signupTitle")

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{title}</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {mode === "login" ? tBuyer("loginHint") : tBuyer("signupHint")}
          </p>
        </div>

        {error ? (
          <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-center text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
            {error}
          </p>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="marketplace-buyer-email"
              className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              {tBuyer("email")}
            </label>
            <input
              id="marketplace-buyer-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 px-4 py-2.5 outline-none focus:ring-2 focus:ring-violet-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label
                htmlFor="marketplace-buyer-password"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                {tBuyer("password")}
              </label>
              {mode === "login" ? (
                <Link
                  href={forgotPasswordHref(null)}
                  className="text-xs font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
                >
                  {t("passwordReset.forgotLink")}
                </Link>
              ) : null}
            </div>
            <input
              id="marketplace-buyer-password"
              type="password"
              required
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 px-4 py-2.5 outline-none focus:ring-2 focus:ring-violet-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-violet-600 py-2.5 font-medium text-white hover:bg-violet-700 disabled:opacity-60"
          >
            {loading
              ? "…"
              : mode === "login"
                ? tBuyer("submitLogin")
                : tBuyer("submitSignup")}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
          {mode === "login" ? (
            <>
              {tBuyer("noAccount")}{" "}
              <Link
                href={signupHref}
                className="font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
              >
                {tBuyer("signUpLink")}
              </Link>
            </>
          ) : (
            <>
              {tBuyer("alreadyClient")}{" "}
              <Link
                href={loginHref}
                className="font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
              >
                {tBuyer("submitLogin")}
              </Link>
            </>
          )}
        </p>

        <p className="mt-4 text-center">
          <Link href="/track-order" className="text-sm text-zinc-500 hover:underline">
            {tBuyer("backTrackOrder")}
          </Link>
        </p>
      </div>
    </div>
  )
}
