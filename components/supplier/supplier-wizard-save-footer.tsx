"use client"

import type { ReactNode } from "react"
import { Loader2, Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type SupplierWizardSaveFooterProps = {
  back?: ReactNode
  continueButton?: ReactNode
  onSaveChanges: () => void
  hasUnsavedChanges: boolean
  savingChanges: boolean
  saveEnabled: boolean
  saveLabel: string
  saveSavingLabel: string
  unsavedHint: string
  savedHint?: string | null
}

export function SupplierWizardSaveFooter({
  back,
  continueButton,
  onSaveChanges,
  hasUnsavedChanges,
  savingChanges,
  saveEnabled,
  saveLabel,
  saveSavingLabel,
  unsavedHint,
  savedHint,
}: SupplierWizardSaveFooterProps) {
  if (!saveEnabled && !back && !continueButton) return null

  return (
    <div className="flex flex-col gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">{back ?? <span className="hidden sm:block" aria-hidden />}</div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
        {saveEnabled ? (
          <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
            {hasUnsavedChanges ? (
              <p className="text-center text-xs font-medium text-amber-700 dark:text-amber-400 sm:text-right">
                {unsavedHint}
              </p>
            ) : savedHint ? (
              <p className="text-center text-xs text-zinc-500 dark:text-zinc-400 sm:text-right">{savedHint}</p>
            ) : null}
            <Button
              type="button"
              variant={hasUnsavedChanges ? "default" : "outline"}
              size="lg"
              disabled={!hasUnsavedChanges || savingChanges}
              onClick={onSaveChanges}
              className={cn(
                "w-full sm:w-auto",
                hasUnsavedChanges && "bg-violet-600 hover:bg-violet-700 dark:bg-violet-600"
              )}
            >
              {savingChanges ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  {saveSavingLabel}
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" aria-hidden />
                  {saveLabel}
                </>
              )}
            </Button>
          </div>
        ) : null}
        {continueButton}
      </div>
    </div>
  )
}
