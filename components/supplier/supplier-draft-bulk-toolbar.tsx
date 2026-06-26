"use client"

import { Loader2, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  totalCount: number
  selectedCount: number
  allSelected: boolean
  onSelectAll: () => void
  onClearSelection: () => void
  onBulkDelete: () => void
  deleting?: boolean
  className?: string
}

export function SupplierDraftBulkToolbar({
  totalCount,
  selectedCount,
  allSelected,
  onSelectAll,
  onClearSelection,
  onBulkDelete,
  deleting = false,
  className,
}: Props) {
  if (totalCount === 0) return null

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30",
        className
      )}
    >
      <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={() => {
            if (allSelected) onClearSelection()
            else onSelectAll()
          }}
          className="size-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-500/40 dark:border-zinc-600"
          aria-label={allSelected ? "Tout désélectionner" : "Tout sélectionner"}
        />
        {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
      </label>

      <span className="text-sm text-zinc-600 dark:text-zinc-400">
        {selectedCount > 0
          ? `${selectedCount} sélectionné${selectedCount > 1 ? "s" : ""} sur ${totalCount}`
          : `${totalCount} brouillon${totalCount > 1 ? "s" : ""}`}
      </span>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {selectedCount > 0 ? (
          <>
            <Button type="button" variant="ghost" size="sm" onClick={onClearSelection} disabled={deleting}>
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={deleting}
              onClick={onBulkDelete}
              className="gap-1.5"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="h-4 w-4" aria-hidden />
              )}
              Supprimer ({selectedCount})
            </Button>
          </>
        ) : null}
      </div>
    </div>
  )
}
