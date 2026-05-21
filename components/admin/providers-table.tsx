"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import type { ProviderListRow } from "@/lib/admin/providers/serialize"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function StatusBadge({ displayStatus }: { displayStatus: ProviderListRow["displayStatus"] }) {
  if (displayStatus === "ACTIVE") {
    return (
      <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
        ACTIVE
      </Badge>
    )
  }
  if (displayStatus === "ERROR") {
    return (
      <Badge className="border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
        ERROR
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="text-zinc-600 dark:text-zinc-400">
      INACTIVE
    </Badge>
  )
}

export function ProvidersTable() {
  const [rows, setRows] = useState<ProviderListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [sealId, setSealId] = useState<string | null>(null)
  const [sealKey, setSealKey] = useState("")
  const [sealSecret, setSealSecret] = useState("")
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/providers", { credentials: "include" })
      const data = (await res.json()) as { rows?: ProviderListRow[] }
      setRows(data.rows ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function testConnection(id: string) {
    setBusyId(id)
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/providers/${id}/test-connection`, {
        method: "POST",
        credentials: "include",
      })
      const data = (await res.json()) as {
        result?: { ok: boolean; message: string }
        row?: ProviderListRow
      }
      if (data.row) {
        setRows((prev) => prev.map((r) => (r.id === id ? data.row! : r)))
      }
      setMessage(
        data.result
          ? `${data.result.ok ? "OK" : "Failed"}: ${data.result.message}`
          : "Test failed"
      )
    } finally {
      setBusyId(null)
    }
  }

  async function disableProvider(id: string) {
    setBusyId(id)
    await fetch(`/api/admin/providers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status: "DISABLED" }),
    })
    await load()
    setBusyId(null)
  }

  async function submitSeal(id: string) {
    setBusyId(id)
    const res = await fetch(`/api/admin/providers/${id}/seal-keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ apiKey: sealKey, apiSecret: sealSecret }),
    })
    if (res.ok) {
      setSealId(null)
      setSealKey("")
      setSealSecret("")
      setMessage("Credentials sealed (AES-256-GCM)")
      await load()
    } else {
      const data = (await res.json().catch(() => ({}))) as { message?: string }
      setMessage(data.message ?? "Seal failed")
    }
    setBusyId(null)
  }

  if (loading) {
    return <p className="mt-8 text-sm text-zinc-500">Loading providers…</p>
  }

  return (
    <div className="mt-8 space-y-4">
      {message ? (
        <p className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          {message}
        </p>
      ) : null}

      {sealId ? (
        <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-900 dark:bg-violet-950/30">
          <p className="text-sm font-medium text-zinc-900 dark:text-white">Seal keys for provider</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Input
              type="password"
              placeholder="API key"
              value={sealKey}
              onChange={(e) => setSealKey(e.target.value)}
              autoComplete="off"
            />
            <Input
              type="password"
              placeholder="API secret"
              value={sealSecret}
              onChange={(e) => setSealSecret(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <Button type="button" size="sm" variant="bentoAccent" onClick={() => void submitSeal(sealId)}>
              Seal & save
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setSealId(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead>Last health check</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-zinc-500">
                No fulfillment providers yet.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium text-zinc-900 dark:text-zinc-100">
                  {row.name}
                  <span className="mt-0.5 block text-xs font-normal text-zinc-500">{row.slug}</span>
                </TableCell>
                <TableCell className="text-xs text-zinc-600 dark:text-zinc-400">{row.type}</TableCell>
                <TableCell>
                  <StatusBadge displayStatus={row.displayStatus} />
                </TableCell>
                <TableCell className="text-xs">{row.paymentMethod}</TableCell>
                <TableCell className="text-xs text-zinc-500">
                  {row.lastHealthCheck
                    ? new Date(row.lastHealthCheck).toLocaleString()
                    : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-wrap justify-end gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busyId === row.id}
                      onClick={() => void testConnection(row.id)}
                    >
                      Test
                    </Button>
                    <Link
                      href={`/admin/providers/${row.id}/edit`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    >
                      Edit
                    </Link>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSealId(row.id)
                        setSealKey("")
                        setSealSecret("")
                      }}
                    >
                      Seal Keys
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={busyId === row.id || row.status === "DISABLED"}
                      onClick={() => void disableProvider(row.id)}
                    >
                      Disable
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
