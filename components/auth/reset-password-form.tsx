"use client"

import type { FormEvent } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { PasswordResetCtaButton } from "@/components/auth/password-reset-cta-button"
import { PasswordResetShell } from "@/components/auth/password-reset-shell"
import type { LoginPortal } from "@/lib/auth-login-portal"

type Props = {
  token: string
}

function parsePortal(raw: string | null): LoginPortal | null {
  const v = raw?.trim().toUpperCase()
  if (v === "AFFILIATE" || v === "SUPPLIER" || v === "AGENT") return v
  return null
}

function loginHref(portal: LoginPortal | null, resetOk: boolean): string {
  const base =
    portal === "AFFILIATE"
      ? "/login/affiliate"
      : portal === "SUPPLIER"
        ? "/login/supplier"
        : portal === "AGENT"
          ? "/login/agent"
          : "/login"
  return resetOk ? `${base}?reset=1` : base
}

const inputClass =
  "w-full rounded-xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-violet-400/50 focus:ring-2 focus:ring-violet-500/30"

export function ResetPasswordForm({ token }: Props) {
  const t = useTranslations("auth.passwordReset")
  const tAuth = useTranslations("auth")
  const router = useRouter()
  const search = useSearchParams()
  const portal = parsePortal(search.get("portal"))
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
      router.push(loginHref(portal, true))
    } catch {
      setError(t("resetFailed"))
    } finally {
      setLoading(false)
    }
  }

  if (!token.trim()) {
    return (
      <PasswordResetShell
        portal={portal}
        badge={t("secureBadge")}
        title={t("resetTitle")}
        subtitle={t("invalidToken")}
        backHref={loginHref(portal, false)}
        backLabel={t("backToLogin")}
      >
        <div className="space-y-4 text-center">
          <p className="text-sm text-zinc-400">{t("invalidToken")}</p>
          <PasswordResetCtaButton href={forgotPasswordHrefFromPortal(portal)} type="button">
            {t("sendResetLink")}
          </PasswordResetCtaButton>
        </div>
      </PasswordResetShell>
    )
  }

  return (
    <PasswordResetShell
      portal={portal}
      badge={t("secureBadge")}
      title={t("resetTitle")}
      subtitle={t("resetSubtitle")}
      backHref={loginHref(portal, false)}
      backLabel={t("backToLogin")}
    >
      {error ? (
        <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label htmlFor="new-password" className="mb-2 block text-sm font-medium text-zinc-300">
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
            placeholder={tAuth("passwordPlaceholder")}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="confirm-password" className="mb-2 block text-sm font-medium text-zinc-300">
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
            placeholder={tAuth("passwordPlaceholder")}
            className={inputClass}
          />
        </div>
        <PasswordResetCtaButton loading={loading}>{t("savePassword")}</PasswordResetCtaButton>
      </form>
    </PasswordResetShell>
  )
}

function forgotPasswordHrefFromPortal(portal: LoginPortal | null): string {
  if (portal === "AFFILIATE") return "/auth/forgot-password?portal=affiliate"
  if (portal === "SUPPLIER") return "/auth/forgot-password?portal=supplier"
  return "/auth/forgot-password"
}
