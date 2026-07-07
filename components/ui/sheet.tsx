"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

type SheetContextValue = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const SheetContext = React.createContext<SheetContextValue | null>(null)

export function Sheet({
  open,
  onOpenChange,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}) {
  return (
    <SheetContext.Provider value={{ open, onOpenChange }}>
      {children}
    </SheetContext.Provider>
  )
}

export function SheetContent({
  side = "right",
  className,
  children,
}: {
  side?: "left" | "right" | "bottom"
  className?: string
  children: React.ReactNode
}) {
  const ctx = React.useContext(SheetContext)
  if (!ctx || !ctx.open) return null

  const panelClass =
    side === "bottom"
      ? "affisell-sheet-panel affisell-sheet-panel--bottom left-0 right-0 top-auto max-h-[min(88dvh,720px)] w-full rounded-t-3xl"
      : cn(
          "affisell-sheet-panel absolute bottom-0 top-0 w-[22rem] max-w-[92vw]",
          side === "left" ? "left-0" : "right-0"
        )

  const close = () => ctx.onOpenChange(false)

  return (
    <div className="fixed inset-0 z-50" role="presentation">
      <button
        type="button"
        aria-label="Close drawer"
        className="affisell-sheet-overlay absolute inset-0 bg-black/40"
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn("absolute border-border bg-background shadow-2xl", panelClass, className)}
      >
        {children}
      </div>
    </div>
  )
}
