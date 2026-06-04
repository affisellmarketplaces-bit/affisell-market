"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import {
  applyConsentChoice,
  readCookieConsentPrefsFromDocument,
} from "@/lib/legal/cookie-consent-runtime"
import type { CookieConsentPrefs } from "@/lib/legal/consent"
import { cn } from "@/lib/utils"

type CookieRow = {
  finalite: string
  editeur: string
  duree: string
  essential?: boolean
}

const COOKIE_ROWS: CookieRow[] = [
  { finalite: "Analytics", editeur: "Google Analytics", duree: "13 mois" },
  { finalite: "Stripe", editeur: "Stripe", duree: "Session", essential: true },
  { finalite: "Session", editeur: "Affisell", duree: "Session", essential: true },
]

export function CookiesSettingsClient() {
  const [analytics, setAnalytics] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const prefs = readCookieConsentPrefsFromDocument()
    if (prefs) setAnalytics(prefs.analytics)
  }, [])

  function saveChoices() {
    const prefs: CookieConsentPrefs = {
      essential: true,
      analytics,
      marketing: analytics,
      updatedAt: new Date().toISOString(),
    }
    applyConsentChoice(prefs)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Aucun cookie analytics ou publicitaire n&apos;est déposé avant votre choix explicite (CNIL 2024 / Consent
        Mode v2). Les cookies essentiels (session, panier, Stripe) sont nécessaires au service.
      </p>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/80">
              <th className="px-4 py-3 text-xs font-semibold uppercase text-zinc-600">Finalité</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-zinc-600">Éditeur</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-zinc-600">Durée</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-zinc-600">Action</th>
            </tr>
          </thead>
          <tbody>
            {COOKIE_ROWS.map((row) => (
              <tr key={row.finalite} className="border-b border-zinc-100 dark:border-zinc-800">
                <td className="px-4 py-3 font-medium text-zinc-900 dark:text-white">{row.finalite}</td>
                <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{row.editeur}</td>
                <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{row.duree}</td>
                <td className="px-4 py-3">
                  {row.essential ? (
                    <span className="text-xs text-zinc-500">Essentiel — non désactivable</span>
                  ) : row.finalite === "Analytics" ? (
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={analytics}
                        onChange={(e) => setAnalytics(e.target.checked)}
                        className="size-4 rounded border-zinc-300 text-violet-600"
                      />
                      {analytics ? "Accepter" : "Refuser"}
                    </label>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={saveChoices}
          className={cn(
            "rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
          )}
        >
          Sauvegarder mes choix
        </button>
        {saved ? (
          <span className="text-sm text-emerald-600 dark:text-emerald-400">Préférences enregistrées.</span>
        ) : null}
        <Link href="/privacy" className="text-sm text-violet-700 underline-offset-2 hover:underline dark:text-violet-300">
          Politique de confidentialité
        </Link>
      </div>
    </div>
  )
}
