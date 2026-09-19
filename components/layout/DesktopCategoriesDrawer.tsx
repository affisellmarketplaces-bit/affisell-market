"use client"

import { LayoutGrid, X } from "lucide-react"
import { useTranslations } from "next-intl"

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
  const t = useTranslations("marketplace.mobileHub")
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        overlayClassName="bg-zinc-950/30 backdrop-blur-[3px]"
        className={
          "z-[300] hidden w-[22rem] flex-col overflow-hidden border-r border-white/15 text-zinc-100 lg:flex " +
          // Frosted glass: 80% tint keeps white text legible even where backdrop-filter is unsupported.
          "bg-zinc-950/80 p-0 shadow-[0_0_60px_-10px_rgba(0,0,0,0.6),inset_-1px_0_0_rgba(255,255,255,0.06)] " +
          "backdrop-blur-2xl backdrop-saturate-150"
        }
      >
        <div className="relative shrink-0 overflow-hidden border-b border-white/10 bg-gradient-to-b from-white/[0.07] to-transparent px-5 py-4">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_0%_0%,rgba(139,92,246,0.28),transparent)]"
            aria-hidden
          />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LayoutGrid className="size-4 text-violet-300" aria-hidden />
              <span className="text-sm font-semibold uppercase tracking-[0.14em] text-white">
                {t("categoriesTitle")}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label={t("close")}
              className="affisell-inp-tap rounded-full border border-white/15 bg-white/5 p-2 text-zinc-300 transition hover:bg-white/10 hover:text-white"
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
