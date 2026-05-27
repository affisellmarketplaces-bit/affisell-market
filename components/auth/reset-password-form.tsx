"use client"

import type { FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"

type Props = {
  token: string
}

export function ResetPasswordForm({ token }: Props) {
  const t = useTranslations("auth.passwordReset")
  const tAuth = useTranslations("auth")
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError(t("passwordTooShort"))
      return
    }
    if (password !== confirm) {
      setError(t("passwordMismatch"))
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        if (data.error === "invalid_token") setError(t("invalidToken"))
        else if (data.error === "password_too_short") setError(t("passwordTooShort"))
        else setError(t("resetFailed"))
        return
      }
      router.push("/login?reset=1")
    } catch {
      setError(t("resetFailed"))
    } finally {
      setLoading(false)
    }
  }

  if (!token.trim()) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
          {t("invalidToken")}
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12 dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm dark:bg-zinc-900">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">{t("resetTitle")}</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-zinc-400">{t("resetSubtitle")}</p>

        {error ? (
          <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-center text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
            {error}
          </p>
        ) : null}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-zinc-300">
              {t("newPassword")}
            </label>
            <input
              id="new-password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-zinc-300">
              {t("confirmPassword")}
            </label>
            <input
              id="confirm-password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? tAuth("connecting") : t("savePassword")}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600 dark:text-zinc-400">
          <Link href="/login" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
            {t("backToLogin")}
          </Link>
        </p>
      </div>
    </div>
  )
}
