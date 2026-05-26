"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import { BentoCard } from "@/components/affisell/bento-ui"
import { Button } from "@/components/ui/button"
import type { CookieConsentPrefs } from "@/lib/legal/consent"

export function GdprAccountPanel() {
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
      setMessage("Préférences enregistrées.")
    } else {
      setMessage("Échec de l'enregistrement.")
    }
  }

  async function deleteAccount() {
    if (!window.confirm("Supprimer définitivement votre compte ? Cette action est irréversible.")) return
    setBusy("delete")
    const res = await fetch("/api/gdpr/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "DELETE" }),
    })
    setBusy(null)
    if (res.ok) {
      window.location.href = "/"
      return
    }
    const data = (await res.json()) as { error?: string }
    setMessage(data.error ?? "Suppression impossible.")
  }

  return (
    <div className="space-y-6">
      {message ? (
        <p className="rounded-lg bg-violet-50 px-4 py-2 text-sm text-violet-900 dark:bg-violet-950/40 dark:text-violet-100">
          {message}
        </p>
      ) : null}

      <BentoCard className="space-y-4 p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Exporter mes données</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Téléchargez une copie de vos données personnelles (profil, commandes, notifications).
        </p>
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
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Consentements cookies</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Gérez les catégories analytics et marketing.{" "}
          <Link href="/legal/cookies-policy" className="text-violet-700 underline-offset-2 hover:underline dark:text-violet-300">
            Politique cookies
          </Link>
        </p>
        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked disabled /> Essentiels (obligatoire)
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
            Analytics
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
            Marketing
          </label>
        </div>
      </BentoCard>

      <BentoCard className="space-y-4 border-red-200 p-6 dark:border-red-900/50">
        <h2 className="text-lg font-semibold text-red-800 dark:text-red-200">Supprimer mon compte</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Conformément au RGPD (droit à l&apos;effacement). Les commandes passées peuvent être conservées de façon
          anonymisée pour obligations comptables.
        </p>
        <Button variant="destructive" size="sm" disabled={busy === "delete"} onClick={() => void deleteAccount()}>
          {busy === "delete" ? "Suppression…" : "Supprimer mon compte"}
        </Button>
      </BentoCard>

      <p className="text-xs text-zinc-500">
        DPO :{" "}
        <a href="mailto:dpo@affisell.com" className="underline">
          dpo@affisell.com
        </a>{" "}
        ·{" "}
        <Link href="/legal/privacy-policy" className="underline">
          Politique de confidentialité
        </Link>
      </p>
    </div>
  )
}
