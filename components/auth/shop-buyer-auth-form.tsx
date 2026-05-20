"use client"

import type { FormEvent } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"

import { credentialsSignInErrorMessage } from "@/lib/auth-portal-signin-messages"
import { sanitizeInternalCallbackUrl } from "@/lib/auth-login-portal"

type Props = {
  storeName: string
  shopSlug: string
  mode: "login" | "signup"
}

export function ShopBuyerAuthForm({ storeName, shopSlug, mode }: Props) {
  const t = useTranslations("auth")
  const search = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const defaultReturn = `/shops/${shopSlug}`
  const rawCallback = search.get("callbackUrl")
  const safeCallback = sanitizeInternalCallbackUrl(rawCallback)
  const returnTo = safeCallback ?? defaultReturn

  const signupHref = useMemo(() => {
    const u = new URLSearchParams()
    u.set("callbackUrl", returnTo)
    u.set("shop", shopSlug)
    return `/signup/customer?${u.toString()}`
  }, [returnTo, shopSlug])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (mode === "signup") {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password, role: "CUSTOMER" }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setLoading(false)
        setError(data.error ?? "Inscription impossible")
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
    setError(credentialsSignInErrorMessage(res?.code, t) ?? t("invalidCredentials"))
  }

  const title = mode === "login" ? `Mon compte ${storeName}` : `Créer un compte ${storeName}`

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{title}</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {mode === "login"
              ? "Connectez-vous pour suivre vos commandes sur cette boutique."
              : "Inscrivez-vous pour commander et suivre vos achats."}
          </p>
        </div>

        {error ? (
          <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-center text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
            {error}
          </p>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label htmlFor="shop-buyer-email" className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Email
            </label>
            <input
              id="shop-buyer-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 px-4 py-2.5 outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>
          <div>
            <label htmlFor="shop-buyer-password" className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Mot de passe
            </label>
            <input
              id="shop-buyer-password"
              type="password"
              required
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 px-4 py-2.5 outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-zinc-900 py-2.5 font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {loading ? "…" : mode === "login" ? "Se connecter" : "Créer mon compte"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
          {mode === "login" ? (
            <>
              Pas encore de compte ?{" "}
              <Link href={signupHref} className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100">
                S&apos;inscrire
              </Link>
            </>
          ) : (
            <>
              Déjà client ?{" "}
              <Link
                href={`/shops/${shopSlug}/login?callbackUrl=${encodeURIComponent(returnTo)}`}
                className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
              >
                Se connecter
              </Link>
            </>
          )}
        </p>

        <p className="mt-4 text-center">
          <Link href={`/shops/${shopSlug}`} className="text-sm text-zinc-500 hover:underline">
            ← Retour à la boutique
          </Link>
        </p>
      </div>
    </div>
  )
}
