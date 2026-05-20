"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { useTranslations } from "next-intl"
import { motion, AnimatePresence } from "framer-motion"
import {
  Command,
  Search,
  ShoppingBag,
  Store,
  User,
  Zap,
  type LucideIcon,
} from "lucide-react"
import { useDebouncedCallback } from "use-debounce"

import { HighlightMatch } from "@/components/command-k/highlight-match"
import {
  buildCommandKCatalog,
  COMMAND_K_SEGMENT_LABEL_KEYS,
  groupCommandKItems,
  type CommandKItem,
  type CommandKSegment,
} from "@/lib/command-k-catalog"
import { rankByFuzzy } from "@/lib/fuzzy-match"
import { shopListingPath } from "@/lib/affiliate-routes"
import { scaleFadeIn } from "@/lib/motion-presets"
import { cn } from "@/lib/utils"

type ResolvedCommandKItem = CommandKItem & { label: string }

type ProductHit = {
  id: string
  name: string
  image: string | null
  price: number
  storeSlug: string | null
}

const SEGMENT_ICONS: Record<CommandKSegment, LucideIcon> = {
  buy: ShoppingBag,
  sell: Store,
  account: User,
}

export function CommandK() {
  const router = useRouter()
  const { data: session } = useSession()
  const t = useTranslations("CommandK")
  const role = session?.user?.role
  const loggedIn = Boolean(session?.user?.id)

  const catalog = useMemo(
    () => buildCommandKCatalog(role, loggedIn),
    [role, loggedIn]
  )

  const items: ResolvedCommandKItem[] = useMemo(
    () => catalog.map((item) => ({ ...item, label: t(item.labelKey) })),
    [catalog, t]
  )

  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const [products, setProducts] = useState<ProductHit[]>([])
  const [previewProduct, setPreviewProduct] = useState<ProductHit | null>(null)

  const filteredNav = useMemo(() => {
    const needle = q.trim()
    const ranked = rankByFuzzy(items, needle, (item) =>
      [
        item.label,
        ...item.keywords,
        t(COMMAND_K_SEGMENT_LABEL_KEYS[item.segment as CommandKSegment]),
      ].join(" ")
    )
    return ranked.map(({ fuzzyRank: _r, ...item }) => item)
  }, [items, q, t])

  const flatRows = useMemo(() => {
    const rows: Array<
      | { kind: "nav"; item: ResolvedCommandKItem }
      | { kind: "product"; item: ProductHit }
    > = filteredNav.map((item) => ({ kind: "nav" as const, item }))
    if (q.trim().length >= 2) {
      for (const p of products) rows.push({ kind: "product", item: p })
    }
    return rows
  }, [filteredNav, products, q])

  const grouped = useMemo(
    () =>
      groupCommandKItems(filteredNav, (segment) =>
        t(COMMAND_K_SEGMENT_LABEL_KEYS[segment])
      ),
    [filteredNav, t]
  )

  const fetchProducts = useDebouncedCallback(async (needle: string) => {
    if (needle.length < 2) {
      setProducts([])
      return
    }
    try {
      const res = await fetch(
        `/api/marketplace/products?q=${encodeURIComponent(needle)}`
      )
      const data = (await res.json()) as {
        products?: Array<{
          id: string
          name: string
          image: string | null
          price: number
          storeSlug: string | null
        }>
      }
      const list = (data.products ?? []).slice(0, 6).map((p) => ({
        id: p.id,
        name: p.name,
        image: p.image,
        price: p.price,
        storeSlug: p.storeSlug,
      }))
      setProducts(list)
    } catch {
      setProducts([])
    }
  }, 280)

  useEffect(() => {
    fetchProducts(q.trim())
  }, [q, fetchProducts])

  useEffect(() => {
    setActiveIndex(0)
    setPreviewProduct(null)
  }, [q, open])

  const runNavItem = useCallback(
    (item: ResolvedCommandKItem) => {
      setOpen(false)
      setQ("")
      if (item.action === "signOut") {
        void signOut({ callbackUrl: "/" })
        return
      }
      const href = item.href
      if (!href) return
      if (href === "/wishlist" && !session?.user?.id) {
        router.push(`/signup/customer?callbackUrl=${encodeURIComponent("/wishlist")}`)
        return
      }
      router.push(href)
    },
    [router, session?.user?.id]
  )

  const runProduct = useCallback(
    (p: ProductHit) => {
      setOpen(false)
      setQ("")
      if (p.storeSlug) {
        router.push(shopListingPath(p.storeSlug, p.id))
      } else {
        router.push(`/shops/browse?q=${encodeURIComponent(p.name)}`)
      }
    },
    [router]
  )

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
        setActiveIndex((i) => Math.min(i + 1, Math.max(0, flatRows.length - 1)))
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
      }
      if (e.key === "Enter" && flatRows[activeIndex]) {
        e.preventDefault()
        const row = flatRows[activeIndex]
        if (row.kind === "nav") runNavItem(row.item)
        else runProduct(row.item)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, flatRows, activeIndex, runNavItem, runProduct])

  useEffect(() => {
    const row = flatRows[activeIndex]
    if (row?.kind === "product") setPreviewProduct(row.item)
    else setPreviewProduct(products[0] ?? null)
  }, [activeIndex, flatRows, products])

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

      <AnimatePresence>
        {open ? (
          <motion.div
            className="fixed inset-0 z-[300] flex items-start justify-center bg-zinc-900/40 p-4 pt-[10vh] backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            role="presentation"
            onClick={() => setOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal
              aria-label={t("triggerLabel")}
              variants={scaleFadeIn}
              initial="hidden"
              animate="visible"
              exit="hidden"
              transition={{ duration: 0.15 }}
              className="flex w-full max-w-3xl gap-0 overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-950"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex min-w-0 flex-1 flex-col">
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
                    {t("escape")}
                  </kbd>
                </div>
                <ul className="max-h-[min(50vh,380px)] overflow-y-auto p-2" role="listbox">
                  {flatRows.length === 0 ? (
                    <li className="px-3 py-8 text-center text-sm text-zinc-500">{t("empty")}</li>
                  ) : (
                    <>
                      {grouped.map(({ segment, label: groupLabel, items: groupItems }) => {
                        const Icon = SEGMENT_ICONS[segment]
                        return (
                          <li key={segment} className="mb-2 last:mb-0">
                            <p className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                              <Icon className="h-3 w-3" aria-hidden />
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
                                      onClick={() => runNavItem(item)}
                                      onMouseEnter={() => setActiveIndex(idx)}
                                      className={cn(
                                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition",
                                        isActive
                                          ? "bg-violet-600 text-white"
                                          : "text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-900"
                                      )}
                                    >
                                      <Command className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                                      <span className="font-medium">
                                        <HighlightMatch text={item.label} query={q} />
                                      </span>
                                    </button>
                                  </li>
                                )
                              })}
                            </ul>
                          </li>
                        )
                      })}
                      {products.length > 0 ? (
                        <li className="mb-2">
                          <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            {t("productsGroup")}
                          </p>
                          <ul>
                            {products.map((p) => {
                              flatIndex += 1
                              const idx = flatIndex
                              const isActive = idx === activeIndex
                              return (
                                <li key={p.id}>
                                  <button
                                    type="button"
                                    role="option"
                                    aria-selected={isActive}
                                    onClick={() => runProduct(p)}
                                    onMouseEnter={() => {
                                      setActiveIndex(idx)
                                      setPreviewProduct(p)
                                    }}
                                    className={cn(
                                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition",
                                      isActive
                                        ? "bg-violet-600 text-white"
                                        : "text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-900"
                                    )}
                                  >
                                    {p.image ? (
                                      <Image
                                        src={p.image}
                                        alt=""
                                        width={32}
                                        height={32}
                                        className="h-8 w-8 rounded-lg object-cover"
                                      />
                                    ) : (
                                      <span className="h-8 w-8 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
                                    )}
                                    <span className="font-medium">
                                      <HighlightMatch text={p.name} query={q} />
                                    </span>
                                  </button>
                                </li>
                              )
                            })}
                          </ul>
                        </li>
                      ) : null}
                    </>
                  )}
                </ul>
              </div>
              {previewProduct?.image ? (
                <aside className="hidden w-44 shrink-0 border-l border-zinc-100 p-4 dark:border-zinc-800 sm:block">
                  <Image
                    src={previewProduct.image}
                    alt={previewProduct.name}
                    width={160}
                    height={160}
                    className="rounded-xl object-cover"
                  />
                  <p className="mt-2 line-clamp-2 text-xs font-medium text-zinc-700 dark:text-zinc-200">
                    {previewProduct.name}
                  </p>
                </aside>
              ) : null}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}
