"use client"

import { Cloud, Loader2, Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type SupplierDraftSyncState = "idle" | "saving" | "saved" | "error"

type Props = {
  syncState: SupplierDraftSyncState
  savedAt: number | null
  disabled?: boolean
  onSave: () => void
  className?: string
  /** Compact: icon button + short status on one row */
  layout?: "inline" | "stacked"
}

function formatSavedAt(ts: number): string {
  return new Date(ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}

export function SupplierDraftSaveControl({
  syncState,
  savedAt,
  disabled = false,
  onSave,
  className,
  layout = "inline",
}: Props) {
  const busy = syncState === "saving" || disabled

  const status = (
    <p className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
      <Cloud className="h-3.5 w-3.5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
      {syncState === "saving" ? (
        <span>Enregistrement…</span>
      ) : syncState === "error" ? (
        <span className="text-amber-700 dark:text-amber-400">Échec — réessayez ou vérifiez la connexion.</span>
      ) : savedAt ? (
        <span>
          Brouillon enregistré à {formatSavedAt(savedAt)}
          <span className="hidden sm:inline"> · sauvegarde auto active</span>
        </span>
      ) : (
        <span>Sauvegarde automatique · enregistrez quand vous voulez</span>
      )}
    </p>
  )

  const saveButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={onSave}
      className={cn(
        "shrink-0 gap-1.5 border-violet-200/80 bg-white/90 text-violet-900 hover:bg-violet-50 dark:border-violet-800/60 dark:bg-zinc-900 dark:text-violet-100 dark:hover:bg-violet-950/50",
        layout === "inline" && "h-9"
      )}
      title="Enregistrer comme brouillon"
      aria-label="Enregistrer comme brouillon"
    >
      {syncState === "saving" ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <Save className="h-4 w-4" aria-hidden />
      )}
      <span className="hidden sm:inline">Enregistrer brouillon</span>
    </Button>
  )

  if (layout === "stacked") {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        {status}
        {saveButton}
      </div>
    )
  }

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2 sm:gap-3", className)}>
      {status}
      {saveButton}
    </div>
  )
}
