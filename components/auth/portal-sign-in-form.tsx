"use client"

import type { FormEvent } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import { useMemo, useState } from "react"

import type { LoginPortal } from "@/lib/auth-login-portal"
import { sanitizeInternalCallbackUrl } from "@/lib/auth-login-portal"
import { messageForCredentialsSignInCode } from "@/lib/auth-portal-signin-messages"

type Props = {
  portal: LoginPortal | null
  title: string
  subtitle: string
  defaultCallback: string
  signupHref: string
  signupLabel?: string
  signInHref?: string
  signInLabel?: string
  showSocialSignIn?: boolean
}

export function PortalSignInForm({
  portal,
  title,
  subtitle,
  defaultCallback,
  signupHref,
  signupLabel = "Create an account",
  signInHref,
  signInLabel,
  showSocialSignIn = false,
}: Props) {
  const search = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rawCallback = search.get("callbackUrl")
  const safeCallback = sanitizeInternalCallbackUrl(rawCallback)
  const resolvedCallback = safeCallback ?? defaultCallback

  const oauthError = search.get("error")
  const resolvedError =
    error ??
    (oauthError === "AccessDenied"
      ? "Connexion refusée : ce compte ne correspond pas à l’espace demandé."
      : oauthError && oauthError !== "OAuthSignin"
        ? "La connexion a échoué. Réessayez ou utilisez l’e-mail et le mot de passe."
        : null)

  const signInCallback = useMemo(() => {
    if (portal === "AFFILIATE") return resolvedCallback || "/marketplace"
    if (portal === "SUPPLIER") return resolvedCallback || "/dashboard/supplier"
    return resolvedCallback
  }, [portal, resolvedCallback])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const res = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
      callbackUrl: signInCallback,
    })
    setLoading(false)
    if (res?.ok) {
      window.location.assign(signInCallback)
      return
    }
    const portalMsg = messageForCredentialsSignInCode(res?.code)
    setError(portalMsg ?? "Invalid email or password.")
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12 dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm dark:bg-zinc-900">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-zinc-100">{title}</h1>
          <p className="mt-2 text-gray-600 dark:text-zinc-400">{subtitle}</p>
        </div>

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
                onClick={() => void signIn("google", { callbackUrl: signInCallback })}
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
                <span className="bg-white px-3 text-gray-500 dark:bg-zinc-900 dark:text-zinc-500">
                  Or use password
                </span>
              </div>
            </div>
          </>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label htmlFor="portal-signin-email" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-zinc-300">
              Email
            </label>
            <input
              id="portal-signin-email"
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
            <label
              htmlFor="portal-signin-password"
              className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-zinc-300"
            >
              Password
            </label>
            <input
              id="portal-signin-password"
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
            {loading ? "Connexion…" : "Se connecter"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600 dark:text-zinc-400">
          <Link href={signupHref} className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400">
            {signupLabel}
          </Link>
          {signInHref && signInLabel ? (
            <>
              {" · "}
              <Link href={signInHref} className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400">
                {signInLabel}
              </Link>
            </>
          ) : null}
        </p>
      </div>
    </div>
  )
}
