"use client"

import { Suspense, useEffect, useState } from "react"
import { LogOut, MoreHorizontal, Settings, X } from "lucide-react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { useTranslations } from "next-intl"

import { FastLink } from "@/components/navigation/fast-link"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import {
  isPartnerDockRoute,
  isPartnerDockSuppressed,
  partnerDockConfig,
  type PartnerNavItem,
  type PartnerRole,
} from "@/lib/partner-mobile-nav"
import { barePathname } from "@/lib/mobile-chrome"
import { cn } from "@/lib/utils"

const BODY_CLASS = "affisell-partner-dock"

function isTextEntry(el: Element | null): boolean {
  if (!el) return false
  const tag = el.tagName
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    (el as HTMLElement).isContentEditable
  )
}

/** Thumb-reachable bottom navigation for suppliers and resellers on phones. */
function PartnerMobileDockInner() {
  const t = useTranslations()
  const { data: session } = useSession()
  const pathname = usePathname() ?? ""
  const search = useSearchParams()
  const [moreOpen, setMoreOpen] = useState(false)
  const [typing, setTyping] = useState(false)

  const roleRaw = String(session?.user?.role ?? "").toUpperCase()
  const role: PartnerRole | null =
    roleRaw === "SUPPLIER" || roleRaw === "AFFILIATE" ? roleRaw : null
  const bare = barePathname(pathname)
  const visible =
    role != null &&
    isPartnerDockRoute(pathname) &&
    !isPartnerDockSuppressed(pathname, search ?? new URLSearchParams())

  useEffect(() => {
    document.body.classList.toggle(BODY_CLASS, visible)
    return () => document.body.classList.remove(BODY_CLASS)
  }, [visible])

  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!visible) return
    const onIn = (e: FocusEvent) => setTyping(isTextEntry(e.target as Element))
    const onOut = () => setTyping(false)
    document.addEventListener("focusin", onIn)
    document.addEventListener("focusout", onOut)
    return () => {
      document.removeEventListener("focusin", onIn)
      document.removeEventListener("focusout", onOut)
    }
  }, [visible])

  if (!visible || !role) return null

  const { tabs, more } = partnerDockConfig(role)
  const params = search ?? new URLSearchParams()
  const moreActive = more.some((i) => i.match(bare, params))

  const renderMoreItem = (item: PartnerNavItem) => {
    const Icon = item.icon
    const active = item.match(bare, params)
    return (
      <li key={item.id}>
        <FastLink
          href={item.href}
          className={cn(
            "flex min-h-[4.25rem] flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-2.5 text-center text-xs font-semibold leading-tight transition active:scale-[0.97]",
            active
              ? "border-violet-500/50 bg-violet-600 text-white shadow-md"
              : "border-zinc-200 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          )}
          aria-current={active ? "page" : undefined}
          onClick={() => setMoreOpen(false)}
        >
          <Icon className="size-5 shrink-0" aria-hidden />
          <span className="line-clamp-2 break-words">{t(item.label)}</span>
        </FastLink>
      </li>
    )
  }

  return (
    <>
      <nav
        aria-label={t("partnerDock.aria")}
        className={cn(
          "affisell-partner-dock-bar fixed inset-x-0 bottom-0 z-[90] md:hidden",
          "border-t border-zinc-200/80 bg-white/90 px-2 pb-[max(0.35rem,env(safe-area-inset-bottom,0px))] pt-1.5 backdrop-blur-2xl",
          "dark:border-zinc-800 dark:bg-zinc-950/90",
          "transition-transform duration-200",
          typing && "translate-y-full"
        )}
      >
        <ul className="mx-auto flex w-full max-w-md items-end justify-between gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const active = tab.match(bare, params)
            return (
              <li key={tab.id} className="flex flex-1 justify-center">
                <FastLink
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-12 w-full max-w-[5rem] flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-[11px] font-semibold leading-none transition active:scale-95",
                    tab.featured
                      ? "-mt-3 bg-gradient-to-br from-violet-600 via-fuchsia-600 to-violet-700 text-white shadow-lg shadow-violet-600/35 ring-4 ring-white dark:ring-zinc-950"
                      : active
                        ? "text-violet-700 dark:text-violet-300"
                        : "text-zinc-500 dark:text-zinc-400"
                  )}
                >
                  <Icon className={cn(tab.featured ? "size-6" : "size-5")} aria-hidden />
                  <span className="max-w-full truncate">{t(tab.label)}</span>
                  {active && !tab.featured ? (
                    <span className="absolute -top-1.5 h-0.5 w-6 rounded-full bg-violet-600 dark:bg-violet-400" aria-hidden />
                  ) : null}
                </FastLink>
              </li>
            )
          })}
          <li className="flex flex-1 justify-center">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              className={cn(
                "relative flex min-h-12 w-full max-w-[5rem] flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-[11px] font-semibold leading-none transition active:scale-95",
                moreActive ? "text-violet-700 dark:text-violet-300" : "text-zinc-500 dark:text-zinc-400"
              )}
            >
              <MoreHorizontal className="size-5" aria-hidden />
              <span className="max-w-full truncate">{t("partnerDock.more")}</span>
              {moreActive ? (
                <span className="absolute -top-1.5 h-0.5 w-6 rounded-full bg-violet-600 dark:bg-violet-400" aria-hidden />
              ) : null}
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="md:hidden">
          <div className="flex items-center justify-between px-5 pb-2 pt-4">
            <p className="text-base font-bold text-zinc-900 dark:text-zinc-50">
              {t("partnerDock.moreTitle")}
            </p>
            <button
              type="button"
              onClick={() => setMoreOpen(false)}
              aria-label={t("partnerDock.close")}
              className="inline-flex size-11 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <ul className="grid grid-cols-3 gap-2.5 overflow-y-auto px-4 pb-3">
            {more.map(renderMoreItem)}
          </ul>
          <div className="mt-1 flex gap-2 border-t border-zinc-200 px-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-3 dark:border-zinc-800">
            <Link
              href="/dashboard/settings/account"
              onClick={() => setMoreOpen(false)}
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white text-sm font-semibold text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <Settings className="size-4" aria-hidden />
              {t("nav.accountMenu.settings")}
            </Link>
            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: "/" })}
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white text-sm font-semibold text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <LogOut className="size-4" aria-hidden />
              {t("nav.accountMenu.signOut")}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

export function PartnerMobileDock() {
  return (
    <Suspense fallback={null}>
      <PartnerMobileDockInner />
    </Suspense>
  )
}
