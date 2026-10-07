"use client"

import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export const complianceInputClass =
  "mt-1.5 w-full rounded-xl border bg-white px-3 py-2.5 text-base text-zinc-900 shadow-sm placeholder:text-zinc-400 transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 md:text-sm dark:bg-zinc-900 dark:text-zinc-50"

export const complianceInputTone = (invalid: boolean) =>
  invalid
    ? "border-red-400 focus:border-red-500 focus:ring-red-500/25 dark:border-red-600"
    : "border-zinc-300 focus:border-violet-500 focus:ring-violet-500/25 dark:border-zinc-600"

/** Label + control + hint + inline error, wired for assistive tech (aria-describedby / aria-invalid come from the control). */
export function ComplianceField({
  id,
  label,
  required,
  hint,
  error,
  children,
  className,
}: {
  id: string
  label: string
  required?: boolean
  hint?: string
  error?: string | null
  children: (a11y: { id: string; "aria-invalid": boolean; "aria-describedby": string | undefined }) => ReactNode
  className?: string
}) {
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined
  return (
    <div className={className}>
      <label htmlFor={id} className="text-xs font-bold uppercase tracking-wide text-zinc-700 dark:text-zinc-200">
        {label}
        {required ? (
          <span className="ml-0.5 text-red-600" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": describedBy })}
      {hint ? (
        <p id={hintId} className={cn("mt-1 text-xs text-zinc-500 dark:text-zinc-400", error && "sr-only")}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="mt-1 text-xs font-medium text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  )
}
