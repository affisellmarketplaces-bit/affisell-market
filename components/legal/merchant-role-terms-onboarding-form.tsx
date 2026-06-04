"use client"

import type { FormEvent } from "react"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { RoleTermsAcceptCheckbox } from "@/components/legal/role-terms-accept-checkbox"
import { roleTermsHrefForRole, roleTermsLabelForRole } from "@/lib/legal/role-terms"
import { cn } from "@/lib/utils"

type Props = {
  role: "SUPPLIER" | "AFFILIATE"
  nextHref: string
  className?: string
}

export function MerchantRoleTermsOnboardingForm({ role, nextHref, className }: Props) {
  const router = useRouter()
  const [roleTermsChecked, setRoleTermsChecked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const label = roleTermsLabelForRole(role)
  const href = roleTermsHrefForRole(role)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!roleTermsChecked) {
      setError(`Vous devez accepter les ${label} pour continuer.`)
      return
    }
    setLoading(true)
    setError(null)

    const res = await fetch("/api/user/role-terms-acceptance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acceptRoleTerms: true }),
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
        Dernière étape : acceptez les {label} applicables à votre compte {role === "SUPPLIER" ? "fournisseur" : "affilié"}.
      </p>
      <RoleTermsAcceptCheckbox
        role={role}
        checked={roleTermsChecked}
        onChange={setRoleTermsChecked}
      />
      <button
        type="submit"
        disabled={!roleTermsChecked || loading}
        className={cn(
          "w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50",
          role === "SUPPLIER" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-violet-600 hover:bg-violet-500"
        )}
      >
        {loading ? "Enregistrement…" : "Continuer"}
      </button>
      {error ? <p className="text-center text-sm text-rose-600 dark:text-rose-300">{error}</p> : null}
      <p className="text-center text-xs text-zinc-500">
        <Link href={href} className="underline-offset-2 hover:underline">
          Lire les {label} en entier
        </Link>
        {" · "}
        <Link href="/cgu" className="underline-offset-2 hover:underline">
          CGU
        </Link>
      </p>
    </form>
  )
}
