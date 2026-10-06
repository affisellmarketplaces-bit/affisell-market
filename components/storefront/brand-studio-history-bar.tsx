"use client"

import { Redo2, Undo2 } from "lucide-react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"

type Props = {
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  className?: string
}

/** Undo / redo for the whole design — one atomic step per Generate, preset, palette or settled edit. */
export function BrandStudioHistoryBar({ canUndo, canRedo, onUndo, onRedo, className }: Props) {
  const t = useTranslations("storefront.brandStudio.history")

  const base =
    "inline-flex h-11 items-center gap-1.5 px-3 text-sm font-medium transition focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-40"

  return (
    <div
      role="group"
      aria-label={t("label")}
      className={cn(
        "inline-flex overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900",
        className
      )}
    >
      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo}
        title={t("undoTitle")}
        className={cn(base, "border-r border-gray-200 hover:bg-gray-50 dark:border-zinc-700 dark:hover:bg-zinc-800")}
      >
        <Undo2 className="size-4" aria-hidden />
        <span className="hidden sm:inline">{t("undo")}</span>
        <span className="sr-only sm:hidden">{t("undo")}</span>
      </button>
      <button
        type="button"
        onClick={onRedo}
        disabled={!canRedo}
        title={t("redoTitle")}
        className={cn(base, "hover:bg-gray-50 dark:hover:bg-zinc-800")}
      >
        <Redo2 className="size-4" aria-hidden />
        <span className="hidden sm:inline">{t("redo")}</span>
        <span className="sr-only sm:hidden">{t("redo")}</span>
      </button>
    </div>
  )
}
