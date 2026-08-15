"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { useTranslations } from "next-intl"

import { AccountDeletionFlow } from "@/components/account/account-deletion-flow"
import { BentoCard } from "@/components/affisell/bento-ui"
import type { CookieConsentPrefs } from "@/lib/legal/consent"

export function GdprAccountPanel() {
  const t = useTranslations("gdprAccount")
  const [consent, setConsent] = useState<CookieConsentPrefs | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch("/api/gdpr/consent", { cache: "no-store" })
    if (!res.ok) return
    const data = (await res.json()) as { cookieConsent: CookieConsentPrefs | null }
    setConsent(data.cookieConsent)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function saveConsent(next: CookieConsentPrefs) {
    setBusy("consent")
    setMessage(null)
    const res = await fetch("/api/gdpr/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    })
    setBusy(null)
    if (res.ok) {
      setConsent(next)
      setMessage(t("consentSaved"))
    } else {
      setMessage(t("consentFailed"))
    }
  }

  return (
    <div className="space-y-6">
      {message ? (
        <p className="rounded-lg bg-violet-50 px-4 py-2 text-sm text-violet-900 dark:bg-violet-950/40 dark:text-violet-100">
          {message}
        </p>
      ) : null}

      <BentoCard className="space-y-4 p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{t("exportTitle")}</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("exportBody")}</p>
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/gdpr/export?format=json"
            className="inline-flex h-8 items-center rounded-md border border-zinc-300 px-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            JSON
          </a>
          <a
            href="/api/gdpr/export?format=csv"
            className="inline-flex h-8 items-center rounded-md border border-zinc-300 px-3 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            CSV
          </a>
        </div>
      </BentoCard>

      <BentoCard className="space-y-4 p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{t("cookiesTitle")}</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {t("cookiesBody")}{" "}
          <Link href="/cookies" className="text-violet-700 underline-offset-2 hover:underline dark:text-violet-300">
            {t("cookiesPolicy")}
          </Link>
        </p>
        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked disabled /> {t("essentialCookies")}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={consent?.analytics ?? false}
              onChange={(e) =>
                saveConsent({
                  essential: true,
                  analytics: e.target.checked,
                  marketing: consent?.marketing ?? false,
                  updatedAt: new Date().toISOString(),
                })
              }
              disabled={busy === "consent"}
            />
            {t("analyticsCookies")}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={consent?.marketing ?? false}
              onChange={(e) =>
                saveConsent({
                  essential: true,
                  analytics: consent?.analytics ?? false,
                  marketing: e.target.checked,
                  updatedAt: new Date().toISOString(),
                })
              }
              disabled={busy === "consent"}
            />
            {t("marketingCookies")}
          </label>
        </div>
      </BentoCard>

      <BentoCard className="space-y-4 border-red-200 p-6 dark:border-red-900/50">
        <h2 className="text-lg font-semibold text-red-800 dark:text-red-200">{t("deleteTitle")}</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("deleteBody")}</p>
        <AccountDeletionFlow variant="gdpr" triggerStyle="destructive" />
      </BentoCard>

      <p className="text-xs text-zinc-500">
        {t("dpoLabel")}{" "}
        <a href="mailto:dpo@affisell.com" className="underline">
          dpo@affisell.com
        </a>{" "}
        ·{" "}
        <Link href="/legal/confidentialite" className="underline">
          {t("privacyPolicy")}
        </Link>
      </p>
    </div>
  )
}
