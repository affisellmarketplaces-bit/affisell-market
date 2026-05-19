"use client"

import type { FormEvent } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import { useMemo, useState, Suspense } from "react"

import { AffiliateBanner } from "@/components/home/AffiliateBanner"
import { inferLoginPortal, sanitizeInternalCallbackUrl } from "@/lib/auth-login-portal"
import { messageForCredentialsSignInCode } from "@/lib/auth-portal-signin-messages"

function SignInContent() {
  const search = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rawCallback = search.get("callbackUrl")
  const portal = inferLoginPortal(rawCallback)
  const safeCallback = sanitizeInternalCallbackUrl(rawCallback)
  const defaultLanding = portal === null ? "/marketplace" : "/dashboard"
  const resolvedCallback = safeCallback ?? defaultLanding
  const showSocialSignIn = portal === null
  const checkoutFlow = Boolean(
    portal === null &&
      safeCallback &&
      (safeCallback.includes("/cart") ||
        safeCallback.startsWith("/marketplace/account") ||
        safeCallback.startsWith("/wishlist"))
  )

  const oauthError = search.get("error")
  const resolvedError =
    error ??
    (oauthError === "AccessDenied"
      ? "Connexion refusée : ce compte ne correspond pas à l’espace demandé (affilié ou fournisseur)."
      : oauthError && oauthError !== "OAuthSignin"
        ? "La connexion a échoué. Réessayez ou utilisez l’e-mail et le mot de passe."
        : null)

  const title = useMemo(() => {
    if (portal === "AFFILIATE" || portal === "SUPPLIER") return "Merchant sign-in"
    if (checkoutFlow) return "Sign in to continue"
    return "Affisell"
  }, [portal, checkoutFlow])

  const subtitle = useMemo(() => {
    if (portal === "AFFILIATE" || portal === "SUPPLIER") return "Sign in with your merchant email"
    if (checkoutFlow) return "Use the same email as your order — or Google for a one-tap buyer account."
    return "Sign in with your email"
  }, [portal, checkoutFlow])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const res = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
      callbackUrl: rawCallback ?? defaultLanding,
    })
    setLoading(false)
    if (res?.ok) {
      window.location.assign(sanitizeInternalCallbackUrl(rawCallback) ?? defaultLanding)
      return
    }
    const portalMsg = messageForCredentialsSignInCode(res?.code)
    setError(portalMsg ?? "Invalid email or password.")
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12 dark:bg-zinc-950">
      <div className="mb-6 w-full max-w-md">
        <AffiliateBanner />
      </div>
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm dark:bg-zinc-900">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-zinc-100">{title}</h1>
          <p className="mt-2 text-gray-600 dark:text-zinc-400">{subtitle}</p>
        </div>

        {checkoutFlow ? (
          <div className="mb-6 space-y-3 rounded-xl border border-violet-100 bg-violet-50/80 p-4 text-left text-sm text-violet-950 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-100">
            <p className="font-medium">Buyer checkout</p>
            <p className="text-violet-900/90 dark:text-violet-200/90">
              New accounts default to a shopper profile. SMS login is not enabled yet — use email/password or Google.
            </p>
          </div>
        ) : null}

        {resolvedError ? (
          <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-center text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
            {resolvedError}
          </p>
        ) : null}

        {showSocialSignIn ? (
          <>
            <div className="space-y-3">
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-800 shadow-sm transition hover:bg-gray-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-800"
                onClick={() => void signIn("google", { callbackUrl: resolvedCallback })}
              >
                <span aria-hidden className="text-lg font-bold text-blue-600">
                  G
                </span>
                Continue with Google
              </button>
            </div>
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200 dark:border-zinc-700" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-3 text-gray-500 dark:bg-zinc-900 dark:text-zinc-500">Or use password</span>
              </div>
            </div>
          </>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label htmlFor="signin-email" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-zinc-300">
              Email
            </label>
            <input
              id="signin-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>
          <div>
            <label htmlFor="signin-password" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-zinc-300">
              Password
            </label>
            <input
              id="signin-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200 dark:border-zinc-700" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white px-3 text-gray-500 dark:bg-zinc-900 dark:text-zinc-500">New to Affisell?</span>
          </div>
        </div>

        <p className="text-center text-sm text-gray-600 dark:text-zinc-400">
          <Link
            href={showSocialSignIn ? "/signup/customer" : "/signup"}
            className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            {showSocialSignIn ? "Create a buyer account" : "Create an account"}
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <SignInContent />
    </Suspense>
  )
}
