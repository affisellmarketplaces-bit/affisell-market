"use client"

import type { FormEvent } from "react"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { LegalSignupConsent } from "@/components/legal/legal-signup-consent"
import { cn } from "@/lib/utils"

type Props = {
  nextHref: string
  className?: string
}

export function AffiliateCguOnboardingForm({ nextHref, className }: Props) {
  const router = useRouter()
  const [cguChecked, setCguChecked] = useState(false)
  const [roleTermsChecked, setRoleTermsChecked] = useState(false)
  const [privacyChecked, setPrivacyChecked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = cguChecked && roleTermsChecked && privacyChecked && !loading

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) {
      setError("Veuillez accepter les CGU, les CGA et la politique de confidentialité.")
      return
    }
    setLoading(true)
    setError(null)

    const res = await fetch("/api/user/cgu-acceptance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        acceptCgu: true,
        acceptRoleTerms: true,
        acceptPrivacy: true,
      }),
    })
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    setLoading(false)

    if (!res.ok) {
      setError(data.error ?? "Enregistrement impossible.")
      return
    }

    router.push(nextHref)
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className={cn("space-y-6", className)}>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Pour activer votre compte affilié, confirmez votre acceptation des documents légaux en vigueur.
      </p>
      <LegalSignupConsent
        role="AFFILIATE"
        cguChecked={cguChecked}
        privacyChecked={privacyChecked}
        onCguChange={setCguChecked}
        onPrivacyChange={setPrivacyChecked}
        roleTermsChecked={roleTermsChecked}
        onRoleTermsChange={setRoleTermsChecked}
      />
      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
      >
        {loading ? "Enregistrement…" : "Continuer"}
      </button>
      {error ? <p className="text-center text-sm text-rose-600 dark:text-rose-300">{error}</p> : null}
      <p className="text-center text-xs text-zinc-500">
        <Link href="/cgu" className="underline-offset-2 hover:underline">
          Lire les CGU en entier
        </Link>
      </p>
    </form>
  )
}
