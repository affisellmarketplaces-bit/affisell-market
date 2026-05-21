"use client"

import { useCallback, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"

type Row = {
  id: string
  rating: number
  body: string
  status: string
  aiScore: number | null
  moderationNote: string | null
  createdAt: string
  product: { id: string; name: string }
  user: { id: string; email: string; name: string | null } | null
}

export function AdminReviewsClient() {
  const [rows, setRows] = useState<Row[]>([])
  const [stats, setStats] = useState<{ flagged: number; pending: number; avgAiScore: number | null } | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/reviews", { credentials: "include" })
      const data = (await res.json()) as { rows?: Row[]; stats?: typeof stats }
      setRows(data.rows ?? [])
      setStats(data.stats ?? null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function bulk(action: "approve" | "reject") {
    if (selected.size === 0) return
    await fetch("/api/admin/reviews", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ids: [...selected], action }),
    })
    setSelected(new Set())
    void load()
  }

  if (loading) {
    return <p className="mt-8 text-sm text-zinc-500">Loading queue…</p>
  }

  return (
    <div className="mt-8 space-y-6">
      {stats ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs font-semibold uppercase text-zinc-500">AI flagged</p>
            <p className="mt-1 text-2xl font-bold">{stats.flagged}</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs font-semibold uppercase text-zinc-500">Pending</p>
            <p className="mt-1 text-2xl font-bold">{stats.pending}</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs font-semibold uppercase text-zinc-500">Avg AI score</p>
            <p className="mt-1 text-2xl font-bold">{stats.avgAiScore?.toFixed(2) ?? "—"}</p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="bentoAccent" disabled={selected.size === 0} onClick={() => void bulk("approve")}>
          Approve selected
        </Button>
        <Button type="button" variant="destructive" disabled={selected.size === 0} onClick={() => void bulk("reject")}>
          Reject selected
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-100 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
            <tr>
              <th className="px-4 py-3" />
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Rating</th>
              <th className="px-4 py-3">AI</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-zinc-100 dark:border-zinc-800">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() =>
                      setSelected((prev) => {
                        const n = new Set(prev)
                        if (n.has(r.id)) n.delete(r.id)
                        else n.add(r.id)
                        return n
                      })
                    }
                  />
                </td>
                <td className="max-w-xs px-4 py-3">
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">{r.product.name}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{r.body}</p>
                </td>
                <td className="px-4 py-3">{r.rating}★</td>
                <td className="px-4 py-3">{r.aiScore?.toFixed(2) ?? "—"}</td>
                <td className="px-4 py-3 font-medium">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-zinc-500">Queue is empty.</p>
        ) : null}
      </div>
    </div>
  )
}
