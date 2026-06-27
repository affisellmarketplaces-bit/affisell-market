"use client"

import type { ReactNode } from "react"
import { Check, Cloud, Loader2, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type WizardAutosaveStatus = "idle" | "dirty" | "saving" | "saved" | "error"

type SupplierWizardSaveFooterProps = {
  back?: ReactNode
  continueButton?: ReactNode
  /** Cloud autosave active on this listing */
  autosaveEnabled?: boolean
  autosaveStatus: WizardAutosaveStatus
  savedHint?: string | null
  autosaveSavingLabel: string
  autosaveDirtyLabel: string
  autosaveSavedLabel: string
  autosaveErrorLabel: string
  syncNowLabel: string
  onSyncNow?: () => void
  syncing?: boolean
}

function AutosavePill({
  status,
  savedHint,
  savingLabel,
  dirtyLabel,
  savedLabel,
  errorLabel,
  syncNowLabel,
  onSyncNow,
  syncing,
}: {
  status: WizardAutosaveStatus
  savedHint?: string | null
  savingLabel: string
  dirtyLabel: string
  savedLabel: string
  errorLabel: string
  syncNowLabel: string
  onSyncNow?: () => void
  syncing?: boolean
}) {
  const showSyncNow = Boolean(onSyncNow) && (status === "dirty" || status === "error")

  return (
    <div className="flex min-w-0 flex-col items-center gap-1 sm:items-end">
      <div
        className={cn(
          "inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium tabular-nums",
          status === "saving" && "border-violet-200/80 bg-violet-50/90 text-violet-800 dark:border-violet-800/60 dark:bg-violet-950/40 dark:text-violet-200",
          status === "dirty" && "border-amber-200/80 bg-amber-50/90 text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200",
          status === "saved" && "border-emerald-200/80 bg-emerald-50/90 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-300",
          status === "error" && "border-red-200/80 bg-red-50/90 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300",
          status === "idle" && "border-zinc-200/80 bg-zinc-50/90 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400"
        )}
      >
        {status === "saving" || syncing ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
        ) : status === "saved" ? (
          <Check className="size-3.5 shrink-0" aria-hidden />
        ) : (
          <Cloud className="size-3.5 shrink-0" aria-hidden />
        )}
        <span className="truncate">
          {status === "saving" || syncing
            ? savingLabel
            : status === "dirty"
              ? dirtyLabel
              : status === "error"
                ? errorLabel
                : savedHint ?? savedLabel}
        </span>
      </div>
      {showSyncNow ? (
        <button
          type="button"
          onClick={onSyncNow}
          disabled={syncing}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-violet-700 underline-offset-2 hover:underline disabled:opacity-50 dark:text-violet-300"
        >
          <RefreshCw className={cn("size-3", syncing && "animate-spin")} aria-hidden />
          {syncNowLabel}
        </button>
      ) : null}
    </div>
  )
}

export function SupplierWizardSaveFooter({
  back,
  continueButton,
  autosaveEnabled = false,
  autosaveStatus,
  savedHint,
  autosaveSavingLabel,
  autosaveDirtyLabel,
  autosaveSavedLabel,
  autosaveErrorLabel,
  syncNowLabel,
  onSyncNow,
  syncing = false,
}: SupplierWizardSaveFooterProps) {
  if (!autosaveEnabled && !back && !continueButton) return null

  return (
    <div
      className={cn(
        "sticky bottom-0 z-20 -mx-4 mt-10 border-t border-zinc-200/80 bg-white/85 px-4 py-4 backdrop-blur-xl",
        "dark:border-zinc-800 dark:bg-zinc-950/90",
        "sm:-mx-6 sm:px-6 lg:-mx-0 lg:rounded-2xl lg:border lg:shadow-lg lg:shadow-violet-500/5"
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 shrink-0">{back ?? <span className="hidden sm:block" aria-hidden />}</div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          {autosaveEnabled ? (
            <AutosavePill
              status={autosaveStatus}
              savedHint={savedHint}
              savingLabel={autosaveSavingLabel}
              dirtyLabel={autosaveDirtyLabel}
              savedLabel={autosaveSavedLabel}
              errorLabel={autosaveErrorLabel}
              syncNowLabel={syncNowLabel}
              onSyncNow={onSyncNow}
              syncing={syncing}
            />
          ) : null}
          {continueButton ? <div className="w-full sm:w-auto">{continueButton}</div> : null}
        </div>
      </div>
    </div>
  )
}
