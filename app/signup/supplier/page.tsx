"use client"

import type { FormEvent } from "react"
import { useState } from "react"
import { signIn } from "next-auth/react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { useTranslations } from "next-intl"

import { credentialsSignInErrorMessage } from "@/lib/auth-portal-signin-messages"

export default function SupplierSignupPage() {
  const t = useTranslations("auth")
  const tSignup = useTranslations("auth.signupSupplier")
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [siret, setSiret] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        role: "SUPPLIER",
        name: companyName.trim() || undefined,
        siret: siret.trim() || undefined,
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
      callbackUrl: "/dashboard/supplier",
    })
    setLoading(false)
    if (login?.error) {
      setError(credentialsSignInErrorMessage(login.code, t) ?? t("signupLoginFail"))
      return
    }
    router.push("/onboarding/supplier")
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10 dark:bg-zinc-950">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-zinc-100">{tSignup("createTitle")}</h1>
          <p className="mt-2 text-gray-600 dark:text-zinc-400">{tSignup("subtitle")}</p>
        </div>

        <div className="rounded-2xl border border-emerald-200/80 bg-white p-8 shadow-sm dark:border-emerald-900/50 dark:bg-zinc-900">
          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label htmlFor="supplier-company" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-zinc-300">
                Nom de l&apos;entreprise
              </label>
              <input
                id="supplier-company"
                type="text"
                required
                autoComplete="organization"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Ma Société SAS"
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-emerald-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>
            <div>
              <label htmlFor="supplier-siret" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-zinc-300">
                SIRET
              </label>
              <input
                id="supplier-siret"
                type="text"
                required
                inputMode="numeric"
                autoComplete="off"
                value={siret}
                onChange={(e) => setSiret(e.target.value.replace(/\D/g, "").slice(0, 14))}
                placeholder="12345678901234"
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-emerald-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>
            <div>
              <label htmlFor="supplier-email" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-zinc-300">
                Email
              </label>
              <input
                id="supplier-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@entreprise.fr"
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-emerald-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>
            <div>
              <label htmlFor="supplier-password" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-zinc-300">
                Mot de passe
              </label>
              <input
                id="supplier-password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none transition focus:ring-2 focus:ring-emerald-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>
            <p className="rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs leading-relaxed text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
              Le Vendeur est seul responsable de la collecte, déclaration et reversement de la TVA.
              Affisell prélève 12&nbsp;% sur le montant HT (produits et livraison), jamais sur la TVA.
            </p>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-emerald-600 py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-60"
            >
              {loading ? t("creating") : tSignup("createButton")}
            </button>
            {error ? <p className="text-center text-sm text-red-600 dark:text-red-400">{error}</p> : null}
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-gray-600 dark:text-zinc-400">
          {tSignup("hasAccount")}{" "}
          <Link href="/login/supplier" className="font-medium text-emerald-700 hover:underline dark:text-emerald-300">
            {tSignup("signIn")}
          </Link>
        </p>
      </div>
    </div>
  )
}
