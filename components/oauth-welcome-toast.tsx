"use client"

import { useEffect, useMemo } from "react"

const MESSAGES: Record<string, string> = {
  google: "Connected with Google · Your profile photo imported.",
  facebook: "Connected with Facebook · Profile linked.",
  apple: "Connected with Apple · Profile synced.",
  twitter: "Connected with X · Your profile synced.",
}

type Props = { provider: string }

export function OAuthWelcomeToast({ provider }: Props) {
  const message = useMemo(() => {
    const id = provider.toLowerCase()
    return MESSAGES[id] ?? `Connected (${id}) · Your profile synced.`
  }, [provider])

  useEffect(() => {
    void fetch("/api/auth/oauth-welcome/dismiss", {
      method: "POST",
      credentials: "include",
    }).catch(() => {})
  }, [])

  return (
    <div
      role="status"
      className="mx-auto mb-6 max-w-4xl rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-950 shadow-sm dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-50"
    >
      {message}
    </div>
  )
}
