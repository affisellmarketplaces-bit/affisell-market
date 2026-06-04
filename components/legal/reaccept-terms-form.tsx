"use client"

import type { FormEvent } from "react"
import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"

import { RoleTermsAcceptCheckbox } from "@/components/legal/role-terms-accept-checkbox"
import { roleTermsHrefForRole, roleTermsLabelForRole } from "@/lib/legal/role-terms"
import { cn } from "@/lib/utils"

type Props = {
  role: "SUPPLIER" | "AFFILIATE"
  previousVersion: string | null
  currentVersion: string
  className?: string
}

export function ReacceptTermsForm({ role, previousVersion, currentVersion, className }: Props) {
  const router = useRouter()
  const search = useSearchParams()
  const { update } = useSession()
  const [roleTermsChecked, setRoleTermsChecked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const label = roleTermsLabelForRole(role)
  const href = roleTermsHrefForRole(role)
  const returnTo = search.get("returnTo")?.trim() || (role === "SUPPLIER" ? "/dashboard/supplier" : "/dashboard/affiliate")

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!roleTermsChecked) {
      setError(`Vous devez accepter les ${label} mises à jour.`)
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

    await update()
    router.push(returnTo.startsWith("/") ? returnTo : `/${returnTo}`)
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className={cn("space-y-6", className)}>
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        <p className="font-semibold">Mise à jour des conditions</p>
        <p className="mt-1 text-amber-100/90">
          Version précédente : <span className="font-mono text-xs">{previousVersion ?? "—"}</span>
        </p>
        <p className="mt-0.5 text-amber-100/90">
          Version actuelle : <span className="font-mono text-xs">{currentVersion}</span>
        </p>
      </div>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Nos {label} ont évolué. Veuillez les relire et confirmer votre acceptation pour continuer à utiliser
        votre espace {role === "SUPPLIER" ? "fournisseur" : "affilié"}.
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
        {loading ? "Enregistrement…" : "J'accepte et je continue"}
      </button>

      {error ? <p className="text-center text-sm text-rose-600 dark:text-rose-300">{error}</p> : null}

      <p className="text-center text-xs text-zinc-500">
        <Link href={href} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
          Lire les {label} en entier
        </Link>
      </p>
    </form>
  )
}
