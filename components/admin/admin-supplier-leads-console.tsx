"use client"

import { useCallback, useMemo, useState, useTransition } from "react"
import { Download, Plus, RefreshCw } from "lucide-react"
import { toast } from "sonner"

import type { LeadStatus } from "@prisma/client"
import type { SupplierLeadStats } from "@/lib/supplier-leads"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type LeadRow = {
  id: string
  email: string
  domain: string
  brand: string
  firstName: string | null
  linkedinUrl: string | null
  status: LeadStatus
  source: string
  contactedAt: string
  repliedAt: string | null
  demoAt: string | null
  convertedAt: string | null
  convertedUserId: string | null
  notes: string | null
}

type ApiResponse = {
  leads: LeadRow[]
  stats: SupplierLeadStats
}

const STATUS_FILTERS: { id: LeadStatus | "all"; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "CONTACTED", label: "Contactés" },
  { id: "REPLIED", label: "Répondu" },
  { id: "DEMO_BOOKED", label: "Demo" },
  { id: "CONVERTED", label: "Convertis" },
  { id: "LOST", label: "Perdus" },
]

const STATUS_BADGE: Record<LeadStatus, string> = {
  CONTACTED: "border-sky-500/40 bg-sky-500/15 text-sky-100",
  REPLIED: "border-amber-500/40 bg-amber-500/15 text-amber-100",
  DEMO_BOOKED: "border-violet-500/40 bg-violet-500/15 text-violet-100",
  CONVERTED: "border-emerald-500/40 bg-emerald-500/15 text-emerald-100",
  LOST: "border-zinc-500/40 bg-zinc-500/15 text-zinc-300",
}

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(
      new Date(iso)
    )
  } catch {
    return iso
  }
}

function escapeCsv(value: string) {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function leadsToOutreachCsv(leads: LeadRow[]) {
  const header = "brand,domain,email,firstName,linkedin"
  const rows = leads
    .filter((l) => l.status === "CONTACTED")
    .map((l) =>
      [l.brand, l.domain, l.email, l.firstName ?? "", l.linkedinUrl ?? ""].map(escapeCsv).join(",")
    )
  return [header, ...rows].join("\n")
}

type Props = {
  initial: ApiResponse
}

export function AdminSupplierLeadsConsole({ initial }: Props) {
  const [leads, setLeads] = useState<LeadRow[]>(initial.leads)
  const [stats, setStats] = useState<SupplierLeadStats>(initial.stats)
  const [filter, setFilter] = useState<LeadStatus | "all">("all")
  const [pending, startTransition] = useTransition()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({
    email: "",
    domain: "",
    brand: "",
    firstName: "",
    source: "manual",
  })

  const filtered = useMemo(() => {
    if (filter === "all") return leads
    return leads.filter((l) => l.status === filter)
  }, [filter, leads])

  const refresh = useCallback(() => {
    startTransition(async () => {
      try {
        const qs = filter !== "all" ? `?status=${filter}` : ""
        const res = await fetch(`/api/admin/supplier-leads${qs}`)
        if (!res.ok) throw new Error("fetch_failed")
        const data = (await res.json()) as ApiResponse
        setLeads(data.leads)
        setStats(data.stats)
      } catch {
        toast.error("Impossible de charger les leads")
      }
    })
  }, [filter])

  const patchLead = useCallback(
    (id: string, payload: Record<string, unknown>) => {
      startTransition(async () => {
        try {
          const res = await fetch(`/api/admin/supplier-leads/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
          const data = await res.json()
          if (!res.ok) {
            toast.error(data.error ?? "Échec mise à jour")
            return
          }
          if (data.bonusCents) {
            toast.success(`Converti — bonus +${data.bonusCents / 100}€ crédité`)
          } else {
            toast.success("Lead mis à jour")
          }
          refresh()
        } catch {
          toast.error("Erreur réseau")
        }
      })
    },
    [refresh]
  )

  const addLead = useCallback(() => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/supplier-leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
        const data = await res.json()
        if (!res.ok) {
          toast.error(data.error ?? "Échec création")
          return
        }
        toast.success("Lead ajouté")
        setShowAdd(false)
        setForm({ email: "", domain: "", brand: "", firstName: "", source: "manual" })
        refresh()
      } catch {
        toast.error("Erreur réseau")
      }
    })
  }, [form, refresh])

  const exportCsv = useCallback(() => {
    const csv = leadsToOutreachCsv(leads)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `supplier-leads-outreach-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("CSV exporté — relance via supplier-outreach-generator.mjs")
  }, [leads])

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Supplier Leads CRM</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Outreach Shopify / LinkedIn — pipeline jusqu&apos;à conversion fournisseur.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={pending}>
            <RefreshCw className={cn("mr-1.5 h-4 w-4", pending && "animate-spin")} />
            Actualiser
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="mr-1.5 h-4 w-4" />
            Export CSV
          </Button>
          <Button size="sm" onClick={() => setShowAdd((v) => !v)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Lead manuel
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-300/80">Total</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-100">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-300/80">Répondu</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-amber-200">{stats.repliedPct}%</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-300/80">Converti</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-200">{stats.convertedPct}%</p>
        </div>
      </div>

      {showAdd ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="grid gap-3 sm:grid-cols-2">
            {(["email", "domain", "brand", "firstName"] as const).map((key) => (
              <label key={key} className="block text-sm">
                <span className="text-zinc-500">{key}</span>
                <input
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </label>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={addLead} disabled={pending || !form.email || !form.brand}>
              Enregistrer
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
              Annuler
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1">
        {STATUS_FILTERS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              filter === tab.id
                ? "bg-violet-100 text-violet-900 dark:bg-violet-950/80 dark:text-violet-100"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/80">
            <tr>
              <th className="px-4 py-3">Brand</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Contacted</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                  Aucun lead
                </td>
              </tr>
            ) : (
              filtered.map((lead) => (
                <tr key={lead.id} className="border-b border-zinc-100 dark:border-zinc-800/80">
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{lead.brand}</p>
                    <p className="text-xs text-zinc-500">{lead.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={cn("border", STATUS_BADGE[lead.status])}>{lead.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{lead.source}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {formatWhen(lead.contactedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {lead.status === "CONTACTED" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => patchLead(lead.id, { status: "REPLIED" })}
                        >
                          Mark Replied
                        </Button>
                      ) : null}
                      {lead.status === "REPLIED" || lead.status === "CONTACTED" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => patchLead(lead.id, { status: "DEMO_BOOKED" })}
                        >
                          Book Demo
                        </Button>
                      ) : null}
                      {lead.status !== "CONVERTED" && lead.status !== "LOST" ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            onClick={() => {
                              const userId = window.prompt("User ID fournisseur converti :")
                              if (userId?.trim()) {
                                patchLead(lead.id, {
                                  status: "CONVERTED",
                                  convertedUserId: userId.trim(),
                                })
                              }
                            }}
                          >
                            Mark Converted
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={pending}
                            onClick={() => patchLead(lead.id, { status: "LOST" })}
                          >
                            Mark Lost
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
