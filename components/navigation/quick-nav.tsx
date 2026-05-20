"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useTranslations } from "next-intl"
import { Command, Search, Zap } from "lucide-react"

import {
  buildQuickNavCatalog,
  groupQuickNavItems,
  QUICK_NAV_SEGMENT_LABEL_KEYS,
  type QuickNavItem,
  type QuickNavSegment,
} from "@/lib/quick-nav-catalog"
import { cn } from "@/lib/utils"

type ResolvedQuickNavItem = QuickNavItem & { label: string }

export function QuickNav() {
  const router = useRouter()
  const { data: session } = useSession()
  const t = useTranslations("QuickNav")
  const role = session?.user?.role
  const loggedIn = Boolean(session?.user?.id)

  const catalog = useMemo(
    () => buildQuickNavCatalog(role, loggedIn),
    [role, loggedIn]
  )

  const items: ResolvedQuickNavItem[] = useMemo(
    () =>
      catalog.map((item) => ({
        ...item,
        label: t(item.labelKey),
      })),
    [catalog, t]
  )

  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return items
    return items.filter((item) => {
      const segmentLabel = t(
        QUICK_NAV_SEGMENT_LABEL_KEYS[item.segment as QuickNavSegment]
      ).toLowerCase()
      return (
        item.label.toLowerCase().includes(needle) ||
        item.keywords.some((k) => k.includes(needle)) ||
        segmentLabel.includes(needle)
      )
    })
  }, [items, q, t])

  const go = useCallback(
    (href: string) => {
      setOpen(false)
      setQ("")
      const path = href.split("#")[0] || href
      if (path === "/wishlist" && !session?.user?.id) {
        router.push(`/signup/customer?callbackUrl=${encodeURIComponent("/wishlist")}`)
        return
      }
      router.push(href)
    },
    [router, session?.user?.id]
  )

  useEffect(() => {
    setActiveIndex(0)
  }, [q, open])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((o) => !o)
        return
      }
      if (!open) return
      if (e.key === "Escape") {
        setOpen(false)
        return
      }
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)))
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
      }
      if (e.key === "Enter" && filtered[activeIndex]) {
        e.preventDefault()
        go(filtered[activeIndex].href)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, filtered, activeIndex, go])

  useEffect(() => {
    if (!open) return
    for (const item of filtered.slice(0, 10)) {
      try {
        router.prefetch(item.href.split("?")[0] ?? item.href)
      } catch {
        /* ignore */
      }
    }
  }, [open, filtered, router])

  const grouped = useMemo(
    () =>
      groupQuickNavItems(filtered, (segment) =>
        t(QUICK_NAV_SEGMENT_LABEL_KEYS[segment])
      ),
    [filtered, t]
  )

  let flatIndex = -1

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-zinc-200/90 bg-zinc-50/90 px-2.5 py-1.5 text-xs font-medium text-zinc-600 shadow-sm transition hover:border-violet-300 hover:bg-white hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-300 dark:hover:border-violet-700 sm:px-3"
        aria-label={`${t("triggerLabel")} (⌘K)`}
      >
        <Zap className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" aria-hidden />
        <span className="hidden lg:inline">{t("triggerLabel")}</span>
        <kbd className="rounded-md border border-zinc-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 dark:border-zinc-600 dark:bg-zinc-950">
          ⌘K
        </kbd>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[300] flex items-start justify-center bg-zinc-900/40 p-4 pt-[12vh] backdrop-blur-sm"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal
            aria-label={t("triggerLabel")}
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-950"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
              <Search className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("placeholder")}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
              />
              <kbd className="hidden rounded border border-zinc-200 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 sm:inline">
                esc
              </kbd>
            </div>
            <ul className="max-h-[min(50vh,360px)] overflow-y-auto p-2" role="listbox">
              {filtered.length === 0 ? (
                <li className="px-3 py-8 text-center text-sm text-zinc-500">{t("empty")}</li>
              ) : (
                grouped.map(({ segment, label: groupLabel, items: groupItems }) => (
                  <li key={segment} className="mb-2 last:mb-0">
                    <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      {groupLabel}
                    </p>
                    <ul>
                      {groupItems.map((item) => {
                        flatIndex += 1
                        const idx = flatIndex
                        const isActive = idx === activeIndex
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={isActive}
                              onClick={() => go(item.href)}
                              onMouseEnter={() => {
                                setActiveIndex(idx)
                                try {
                                  router.prefetch(item.href.split("?")[0] ?? item.href)
                                } catch {
                                  /* ignore */
                                }
                              }}
                              className={cn(
                                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition",
                                isActive
                                  ? "bg-violet-600 text-white"
                                  : "text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-900"
                              )}
                            >
                              <Command className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                              <span className="font-medium">{item.label}</span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  )
}
