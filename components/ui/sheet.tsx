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
  side?: "left" | "right"
  className?: string
  children: React.ReactNode
}) {
  const ctx = React.useContext(SheetContext)
  if (!ctx || !ctx.open) return null

  const sideClass = side === "left" ? "left-0" : "right-0"

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close drawer"
        className="absolute inset-0 bg-black/40"
        onClick={() => ctx.onOpenChange(false)}
      />
      <div
        className={cn(
          "absolute bottom-0 top-0 w-[22rem] max-w-[92vw] border-border bg-background shadow-2xl",
          sideClass,
          className
        )}
      >
        {children}
      </div>
    </div>
  )
}
