"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, ShieldCheck } from "lucide-react"

import { BentoCard } from "@/components/affisell/bento-ui"
import {
  LEGAL_COCKPIT_CARD,
  LEGAL_COCKPIT_TABLE_HEAD,
  LEGAL_COCKPIT_TABLE_ROW,
  LEGAL_COCKPIT_TABLE_WRAP,
  LEGAL_COCKPIT_TEXT_MUTED,
  LEGAL_COCKPIT_TEXT_PRIMARY,
} from "@/components/admin/legal-cockpit-ui"
import { buttonVariants } from "@/components/ui/button"
import { scoreKycBadgeClass } from "@/lib/legal/kyc-shared"
import { cn } from "@/lib/utils"

type SupplierKycRow = {
  supplierId: string
  name: string
  email: string
  siret: string | null
  tva: string | null
  verificationStatus: string | null
  kyc: {
    score: number
    status: string
    siretValid: boolean
    tvaValid: boolean
    companyName: string | null
    checkedAt: string
  } | null
}

export function KycPanel() {
  const [suppliers, setSuppliers] = useState<SupplierKycRow[]>([])
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/legal/kyc/all", { credentials: "include", cache: "no-store" })
      const data = (await res.json()) as { ok?: boolean; suppliers?: SupplierKycRow[]; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setSuppliers(data.suppliers ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "load_failed")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function verify(supplier: SupplierKycRow) {
    setVerifying(supplier.supplierId)
    setError(null)
    try {
      const res = await fetch("/api/legal/kyc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          supplierId: supplier.supplierId,
          siret: supplier.siret ?? undefined,
          tva: supplier.tva ?? undefined,
        }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "verify_failed")
    } finally {
      setVerifying(null)
    }
  }

  return (
    <BentoCard className={LEGAL_COCKPIT_CARD}>
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 text-emerald-400" aria-hidden />
        <p className={cn("text-sm font-semibold", LEGAL_COCKPIT_TEXT_PRIMARY)}>KYC Fournisseurs</p>
      </div>
      <p className={cn("mt-1 text-xs", LEGAL_COCKPIT_TEXT_MUTED)}>Vérification SIRET (Pappers) + TVA (VIES) — obligation DSA traceability.</p>

      {error ? (
        <p className="mt-3 rounded-lg border border-red-400/30 bg-red-950/40 px-3 py-2 text-sm text-red-200">{error}</p>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-6 animate-spin text-zinc-500" />
        </div>
      ) : (
        <div className={cn("mt-4", LEGAL_COCKPIT_TABLE_WRAP)}>
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className={LEGAL_COCKPIT_TABLE_HEAD}>
              <tr>
                <th className="px-4 py-3">Fournisseur</th>
                <th className="px-4 py-3">SIRET / TVA</th>
                <th className="px-4 py-3">Score KYC</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => {
                const score = s.kyc?.score ?? 0
                return (
                  <tr key={s.supplierId} className={LEGAL_COCKPIT_TABLE_ROW}>
                    <td className="px-4 py-3.5">
                      <p className={cn("font-semibold", LEGAL_COCKPIT_TEXT_PRIMARY)}>{s.name}</p>
                      <p className={cn("text-[11px]", LEGAL_COCKPIT_TEXT_MUTED)}>{s.email}</p>
                    </td>
                    <td className={cn("px-4 py-3.5 text-xs", LEGAL_COCKPIT_TEXT_MUTED)}>
                      {s.siret ?? "—"} / {s.tva ?? "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-xs font-mono font-bold ring-1",
                          scoreKycBadgeClass(score)
                        )}
                      >
                        {score}/100
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs font-semibold uppercase text-zinc-300">
                      {s.kyc?.status ?? "non vérifié"}
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        type="button"
                        className={cn(buttonVariants({ size: "sm" }), "h-7 text-[10px] bg-emerald-800")}
                        disabled={verifying === s.supplierId}
                        onClick={() => void verify(s)}
                      >
                        {verifying === s.supplierId ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          "Vérifier"
                        )}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </BentoCard>
  )
}
