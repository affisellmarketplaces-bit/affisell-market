"use client"

import { AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { VariantRowValidationIssue } from "@/lib/supplier-sku-builder"
import { cn } from "@/lib/utils"

type Props = {
  issues: VariantRowValidationIssue[]
  className?: string
}

function issueLabel(issue: VariantRowValidationIssue): string {
  const line = issue.index + 1
  return `Ligne ${line}: ${issue.message}`
}

export function scrollToSkuRow(index: number) {
  const row = document.querySelector(`[data-sku-row="${index}"]`)
  row?.scrollIntoView({ behavior: "smooth", block: "center" })
  const input = row?.querySelector<HTMLElement>("input, select, textarea")
  input?.focus({ preventScroll: true })
}

export function SupplierSkuErrorsAlert({ issues, className }: Props) {
  if (issues.length === 0) return null

  const unique = issues.slice(0, 8)

  return (
    <div className={cn("space-y-2", className)} role="alert">
      {unique.map((issue, i) => (
        <div
          key={`${issue.index}-${issue.field}-${i}`}
          className="flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
            <p className="font-medium">{issueLabel(issue)}</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0 border-red-300 bg-white hover:bg-red-50 dark:border-red-700 dark:bg-red-950/60"
            onClick={() => scrollToSkuRow(issue.index)}
          >
            Corriger
          </Button>
        </div>
      ))}
    </div>
  )
}
