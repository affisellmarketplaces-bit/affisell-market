"use client"

import type { FormEvent } from "react"
import { Mail } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { PasswordResetCtaButton } from "@/components/auth/password-reset-cta-button"
import { PasswordResetShell } from "@/components/auth/password-reset-shell"
import type { LoginPortal } from "@/lib/auth-login-portal"

type Props = {
  portal?: LoginPortal | null
}

function loginBackHref(portal: LoginPortal | null | undefined): string {
  if (portal === "AFFILIATE") return "/login/affiliate"
  if (portal === "SUPPLIER") return "/login/supplier"
  return "/login"
}

const inputClass =
  "w-full rounded-xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-violet-400/50 focus:ring-2 focus:ring-violet-500/30"

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
    <PasswordResetShell
      portal={portal}
      badge={t("secureBadge")}
      title={t("forgotTitle")}
      subtitle={t("forgotSubtitle")}
      backHref={loginBackHref(portal)}
      backLabel={t("backToLogin")}
    >
      {sent ? (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/30">
            <Mail className="h-5 w-5 text-emerald-300" aria-hidden />
          </div>
          <p className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm leading-relaxed text-emerald-100">
            {t("forgotSuccess")}
          </p>
        </div>
      ) : (
        <>
          {error ? (
            <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-sm text-red-200">
              {error}
            </p>
          ) : null}
          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label htmlFor="forgot-email" className="mb-2 block text-sm font-medium text-zinc-300">
                {tAuth("email")}
              </label>
              <input
                id="forgot-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                className={inputClass}
              />
            </div>
            <PasswordResetCtaButton loading={loading} disabled={!email.trim()}>
              {t("sendResetLink")}
            </PasswordResetCtaButton>
          </form>
        </>
      )}
    </PasswordResetShell>
  )
}
