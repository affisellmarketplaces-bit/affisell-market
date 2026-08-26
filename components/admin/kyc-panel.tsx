"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, ShieldCheck } from "lucide-react"

import { BentoCard } from "@/components/affisell/bento-ui"
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
    <BentoCard className="border-zinc-800 bg-zinc-950/90 p-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 text-emerald-400" aria-hidden />
        <p className="text-sm font-semibold text-white">KYC Fournisseurs</p>
      </div>
      <p className="mt-1 text-xs text-zinc-500">Vérification SIRET (Pappers) + TVA (VIES) — obligation DSA traceability.</p>

      {error ? (
        <p className="mt-3 rounded-lg border border-red-400/30 bg-red-950/40 px-3 py-2 text-sm text-red-200">{error}</p>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-6 animate-spin text-zinc-500" />
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="py-2">Fournisseur</th>
                <th className="py-2">SIRET / TVA</th>
                <th className="py-2">Score KYC</th>
                <th className="py-2">Statut</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => {
                const score = s.kyc?.score ?? 0
                return (
                  <tr key={s.supplierId} className="border-t border-zinc-800/80">
                    <td className="py-3">
                      <p className="font-medium text-zinc-200">{s.name}</p>
                      <p className="text-[10px] text-zinc-500">{s.email}</p>
                    </td>
                    <td className="py-3 text-xs text-zinc-400">
                      {s.siret ?? "—"} / {s.tva ?? "—"}
                    </td>
                    <td className="py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-mono ring-1",
                          scoreKycBadgeClass(score)
                        )}
                      >
                        {score}/100
                      </span>
                    </td>
                    <td className="py-3 text-xs uppercase text-zinc-400">
                      {s.kyc?.status ?? "non vérifié"}
                    </td>
                    <td className="py-3">
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
