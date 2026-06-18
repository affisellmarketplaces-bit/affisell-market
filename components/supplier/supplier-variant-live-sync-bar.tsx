"use client"

import { Cloud, CloudOff, Loader2, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type VariantLiveSyncStatus = "idle" | "saving" | "saved" | "error"

type SupplierVariantLiveSyncBarProps = {
  status: VariantLiveSyncStatus
  dirty: boolean
  savedAt: number | null
  enabled: boolean
  onFlush: () => void
  labels: {
    live: string
    saving: string
    saved: string
    error: string
    dirty: string
    flush: string
  }
}

export function SupplierVariantLiveSyncBar({
  status,
  dirty,
  savedAt,
  enabled,
  onFlush,
  labels,
}: SupplierVariantLiveSyncBarProps) {
  if (!enabled) return null

  const savedLabel =
    savedAt != null
      ? labels.saved.replace(
          "{time}",
          new Date(savedAt).toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
          })
        )
      : null

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border px-4 py-3 shadow-sm backdrop-blur-md",
        dirty
          ? "border-violet-300/80 bg-gradient-to-r from-violet-50/95 via-white/90 to-fuchsia-50/80 dark:border-violet-700/50 dark:from-violet-950/40 dark:via-zinc-950/60 dark:to-fuchsia-950/30"
          : "border-zinc-200/80 bg-white/80 dark:border-zinc-800 dark:bg-zinc-950/70",
        status === "error" &&
          "border-red-300/80 bg-red-50/90 dark:border-red-800/60 dark:bg-red-950/30"
      )}
      aria-live="polite"
    >
      {dirty ? (
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-violet-500/0 via-violet-400/10 to-fuchsia-500/0 motion-safe:animate-pulse"
          aria-hidden
        />
      ) : null}
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
              status === "error"
                ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                : dirty
                  ? "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
            )}
          >
            {status === "saving" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : status === "error" ? (
              <CloudOff className="h-4 w-4" aria-hidden />
            ) : dirty ? (
              <Sparkles className="h-4 w-4" aria-hidden />
            ) : (
              <Cloud className="h-4 w-4" aria-hidden />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {status === "saving"
                ? labels.saving
                : status === "error"
                  ? labels.error
                  : dirty
                    ? labels.dirty
                    : labels.live}
            </p>
            {!dirty && savedLabel ? (
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{savedLabel}</p>
            ) : dirty ? (
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{labels.live}</p>
            ) : null}
          </div>
        </div>
        {dirty ? (
          <Button
            type="button"
            size="sm"
            className="shrink-0 bg-violet-600 hover:bg-violet-700 dark:bg-violet-600"
            disabled={status === "saving"}
            onClick={onFlush}
          >
            {status === "saving" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                {labels.saving}
              </>
            ) : (
              labels.flush
            )}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
