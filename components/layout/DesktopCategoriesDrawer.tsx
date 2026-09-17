"use client"

import { LayoutGrid, X } from "lucide-react"

import { CategoryTree } from "@/components/layout/CategoryTree"
import { Sheet, SheetContent } from "@/components/ui/sheet"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Desktop "all categories" drawer — the familiar hamburger → full category
 * list pattern, next to the primary nav pills. Same CategoryTree data/routes
 * already proven in the mobile buyer hub, just reachable without shrinking
 * the viewport.
 */
export function DesktopCategoriesDrawer({ open, onOpenChange }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="z-[300] hidden w-[22rem] flex-col border-white/10 bg-zinc-950 p-0 text-zinc-100 lg:flex"
      >
        <div className="relative shrink-0 overflow-hidden border-b border-white/10 bg-gradient-to-br from-violet-950 via-zinc-950 to-indigo-950 px-5 py-4">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_0%_0%,rgba(139,92,246,0.35),transparent)]"
            aria-hidden
          />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LayoutGrid className="size-4 text-violet-300" aria-hidden />
              <span className="text-sm font-bold uppercase tracking-[0.14em] text-white">
                Categories
              </span>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Close categories"
              className="affisell-inp-tap rounded-full border border-white/10 p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
          <CategoryTree onNavigate={() => onOpenChange(false)} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
