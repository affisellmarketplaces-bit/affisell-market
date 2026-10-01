"use client"

import { useState } from "react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"

type FlagRow = {
  key: string
  enabled: boolean
  updatedAt: string | null
  updatedBy: string | null
  title: string
  description: string
}

function formatUpdatedAt(iso: string | null): string {
  if (!iso) return "Jamais modifié"
  return new Date(iso).toLocaleString("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

function ToggleSwitch({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean
  disabled: boolean
  onChange: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2",
        disabled && "cursor-not-allowed opacity-60",
        checked ? "bg-amber-500" : "bg-zinc-300 dark:bg-zinc-700"
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  )
}

export function PlatformFlagsClient({ initialFlags }: { initialFlags: FlagRow[] }) {
  const [flags, setFlags] = useState(initialFlags)
  const [pendingKey, setPendingKey] = useState<string | null>(null)

  const toggle = async (row: FlagRow) => {
    const nextEnabled = !row.enabled
    setPendingKey(row.key)
    setFlags((prev) => prev.map((f) => (f.key === row.key ? { ...f, enabled: nextEnabled } : f)))

    try {
      const res = await fetch("/api/admin/platform-flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ key: row.key, enabled: nextEnabled }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? "Échec de la mise à jour")
      }
      const j = (await res.json()) as {
        flags: Array<{ key: string; enabled: boolean; updatedAt: string | null; updatedBy: string | null }>
      }
      setFlags((prev) =>
        prev.map((f) => {
          const fresh = j.flags.find((x) => x.key === f.key)
          return fresh ? { ...f, ...fresh } : f
        })
      )
      toast.success(
        nextEnabled ? `${row.title} — mis en pause` : `${row.title} — réactivé`
      )
    } catch (err) {
      setFlags((prev) => prev.map((f) => (f.key === row.key ? { ...f, enabled: row.enabled } : f)))
      toast.error(err instanceof Error ? err.message : "Échec de la mise à jour")
    } finally {
      setPendingKey(null)
    }
  }

  return (
    <div className="space-y-3">
      {flags.map((row) => (
        <div
          key={row.key}
          className="flex items-start justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-zinc-900 dark:text-zinc-50">{row.title}</p>
              {row.enabled ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  En pause
                </span>
              ) : (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                  Actif
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{row.description}</p>
            <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
              {formatUpdatedAt(row.updatedAt)}
              {row.updatedBy ? ` · par ${row.updatedBy}` : ""}
            </p>
          </div>
          <ToggleSwitch
            checked={row.enabled}
            disabled={pendingKey === row.key}
            onChange={() => void toggle(row)}
          />
        </div>
      ))}
    </div>
  )
}
