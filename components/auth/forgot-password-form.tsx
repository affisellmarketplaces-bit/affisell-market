"use client"

import type { FormEvent } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useState } from "react"

import type { LoginPortal } from "@/lib/auth-login-portal"

type Props = {
  portal?: LoginPortal | null
}

function loginBackHref(portal: LoginPortal | null | undefined): string {
  if (portal === "AFFILIATE") return "/login/affiliate"
  if (portal === "SUPPLIER") return "/login/supplier"
  return "/login"
}

export function ForgotPasswordForm({ portal = null }: Props) {
  const t = useTranslations("auth.passwordReset")
  const tAuth = useTranslations("auth")
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setError(data.error === "missing_email" ? tAuth("email") : t("requestFailed"))
        return
      }
      setSent(true)
    } catch {
      setError(t("requestFailed"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12 dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm dark:bg-zinc-900">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">{t("forgotTitle")}</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-zinc-400">{t("forgotSubtitle")}</p>

        {sent ? (
          <p className="mt-6 rounded-xl bg-emerald-50 px-3 py-3 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
            {t("forgotSuccess")}
          </p>
        ) : (
          <>
            {error ? (
              <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-center text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
                {error}
              </p>
            ) : null}
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="forgot-email" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-zinc-300">
                  {tAuth("email")}
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-blue-600 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? tAuth("connecting") : t("sendResetLink")}
              </button>
            </form>
          </>
        )}

        <p className="mt-6 text-center text-sm text-gray-600 dark:text-zinc-400">
          <Link href={loginBackHref(portal)} className="font-medium text-blue-600 hover:underline dark:text-blue-400">
            {t("backToLogin")}
          </Link>
        </p>
      </div>
    </div>
  )
}
