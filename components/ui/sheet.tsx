"use client"

import * as React from "react"
import { createPortal } from "react-dom"

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
  overlayClassName,
  children,
}: {
  side?: "left" | "right" | "bottom"
  className?: string
  /** Extra classes for the backdrop (e.g. a blurred veil behind a glass panel). */
  overlayClassName?: string
  children: React.ReactNode
}) {
  const ctx = React.useContext(SheetContext)
  if (!ctx || !ctx.open) return null
  if (typeof document === "undefined") return null

  const panelClass =
    side === "bottom"
      ? "affisell-sheet-panel affisell-sheet-panel--bottom bottom-0 left-0 right-0 flex max-h-[min(92dvh,820px)] w-full flex-col rounded-t-3xl"
      : cn(
          "affisell-sheet-panel absolute bottom-0 top-0 w-[22rem] max-w-[92vw]",
          side === "left" ? "left-0" : "right-0"
        )

  const close = () => ctx.onOpenChange(false)

  return createPortal(
    <div className="fixed inset-0 z-[320]" role="presentation">
      <button
        type="button"
        aria-label="Close drawer"
        className={cn("affisell-sheet-overlay absolute inset-0 bg-black/40", overlayClassName)}
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "absolute border-border bg-background shadow-2xl",
          side === "bottom" && "bottom-0",
          panelClass,
          className
        )}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}
