"use client"

import { Copy, Trash2 } from "lucide-react"

import { cn } from "@/lib/utils"

type Props = {
  label: string
  disabled?: boolean
  onDuplicate?: () => void
  onRemove: () => void
  className?: string
}

export function SupplierCustomColumnChip({
  label,
  disabled,
  onDuplicate,
  onRemove,
  className,
}: Props) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-0.5 rounded-full border border-violet-200/90 bg-violet-50/80 py-1 pl-3 pr-1 text-xs font-medium text-violet-950 dark:border-violet-800/80 dark:bg-violet-950/40 dark:text-violet-100",
        className
      )}
    >
      <span className="truncate">{label}</span>
      {onDuplicate ? (
        <button
          type="button"
          disabled={disabled}
          className="rounded-full p-1 text-violet-700/80 transition hover:bg-violet-100 hover:text-violet-900 disabled:opacity-40 dark:text-violet-300 dark:hover:bg-violet-900/60 dark:hover:text-violet-50"
          onClick={onDuplicate}
          title="Dupliquer cette colonne (copie les valeurs par ligne)"
          aria-label={`Dupliquer la colonne ${label}`}
        >
          <Copy className="h-3 w-3" aria-hidden />
        </button>
      ) : null}
      <button
        type="button"
        disabled={disabled}
        className="rounded-full p-1 text-zinc-500 transition hover:bg-zinc-200/90 hover:text-red-600 disabled:opacity-40 dark:hover:bg-zinc-700 dark:hover:text-red-400"
        onClick={onRemove}
        title="Retirer cette colonne"
        aria-label={`Retirer la colonne ${label}`}
      >
        <Trash2 className="h-3 w-3" aria-hidden />
      </button>
    </span>
  )
}
