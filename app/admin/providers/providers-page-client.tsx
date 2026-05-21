"use client"

import { useMemo, useState } from "react"
import useSWR, { useSWRConfig } from "swr"
import { toast } from "sonner"
import type { ColumnDef } from "@tanstack/react-table"

import { fetchProviders } from "@/lib/admin/providers/fetch"
import type { ProviderListRow } from "@/lib/admin/providers/serialize"
import { DataTable } from "@/components/admin/data-table"
import { HealthBadge } from "@/components/admin/health-badge"
import { ProviderCreateDialog } from "@/components/admin/provider-create-dialog"
import { ProviderEditDialog } from "@/components/admin/provider-edit-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export function ProvidersPageClient() {
  const { mutate } = useSWRConfig()
  const [testingId, setTestingId] = useState<string | null>(null)

  const { data: providers, isLoading, error } = useSWR(
    "/api/admin/providers",
    fetchProviders,
    { revalidateOnFocus: true }
  )

  const rows = providers ?? []

  const testConnection = async (id: string) => {
    setTestingId(id)
    try {
      const res = await fetch(`/api/admin/providers/${id}/health`, {
        method: "POST",
        credentials: "include",
      })
      const data = (await res.json()) as {
        ok?: boolean
        latency?: number | null
        message?: string
      }
      const ok = Boolean(data.ok)
      const latency = data.latency
      if (ok) {
        toast.success(`OK${latency != null ? ` ${latency}ms` : ""}`)
      } else {
        toast.error(data.message ?? "Failed")
      }
      await mutate("/api/admin/providers")
    } catch {
      toast.error("Test failed")
    } finally {
      setTestingId(null)
    }
  }

  const columns = useMemo<ColumnDef<ProviderListRow, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Nom",
        cell: ({ row }) => (
          <div>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">{row.original.name}</span>
            <span className="mt-0.5 block text-xs text-zinc-500">{row.original.slug}</span>
          </div>
        ),
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => <Badge variant="outline">{row.original.type}</Badge>,
      },
      {
        accessorKey: "paymentMethod",
        header: "Paiement",
        cell: ({ row }) => (
          <span className="text-xs text-zinc-600 dark:text-zinc-400">{row.original.paymentMethod}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <HealthBadge status={row.original.status} latency={row.original.latencyMs} />
        ),
      },
      {
        id: "lastHealthCheck",
        header: "Dernier test",
        cell: ({ row }) => (
          <span className="text-xs text-zinc-500">
            {row.original.lastHealthCheck
              ? new Date(row.original.lastHealthCheck).toLocaleString()
              : "—"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={testingId === row.original.id}
              onClick={() => void testConnection(row.original.id)}
            >
              {testingId === row.original.id ? "…" : "Test"}
            </Button>
            <ProviderEditDialog
              provider={row.original}
              onUpdated={() => void mutate("/api/admin/providers")}
            />
          </div>
        ),
      },
    ],
    [mutate, testingId]
  )

  return (
    <div className="p-8 md:p-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Fournisseurs</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Test connexion live, seal credentials — sans toucher au code.
          </p>
        </div>
        <ProviderCreateDialog onCreated={() => void mutate("/api/admin/providers")} />
      </div>

      {error ? (
        <p className="mb-4 text-sm text-red-600">Impossible de charger les fournisseurs.</p>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-zinc-500">Chargement…</p>
      ) : (
        <DataTable data={rows} columns={columns} emptyMessage="Aucun fournisseur configuré." />
      )}
    </div>
  )
}
