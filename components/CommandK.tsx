"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { useLocale, useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { Command } from "cmdk"
import { AnimatePresence, motion } from "framer-motion"
import { Search, ShoppingBag, Store, User, Zap } from "lucide-react"
import { useDebouncedCallback } from "use-debounce"

import {
  buildCommandKCatalog,
  COMMAND_K_SEGMENT_LABEL_KEYS,
  type CommandKItem,
  type CommandKSegment,
} from "@/lib/command-k-catalog"
import { rankByFuzzy } from "@/lib/fuzzy-match"
import { shopListingPath } from "@/lib/affiliate-routes"
import { cn } from "@/lib/utils"

type ResolvedItem = CommandKItem & { label: string }

type ProductHit = {
  id: string
  name: string
  image: string | null
  price: number
  storeSlug: string | null
}

const SEGMENT_ICONS: Record<CommandKSegment, typeof ShoppingBag> = {
  buy: ShoppingBag,
  sell: Store,
  account: User,
}

function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim().toLowerCase()
  if (!q) return <>{text}</>
  const i = text.toLowerCase().indexOf(q)
  if (i < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-violet-200/80 px-0.5 dark:bg-violet-500/40">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  )
}

export const COMMAND_K_OPEN_EVENT = "affisell:command-k-open"

type CommandKProps = {
  /** When false, only ⌘K shortcut + modal (for global shell). */
  showTrigger?: boolean
}

export function CommandK({ showTrigger = true }: CommandKProps) {
  const t = useTranslations("CommandK")
  const locale = useLocale()
  const router = useRouter()
  const { data: session } = useSession()
  const role = session?.user?.role
  const loggedIn = Boolean(session?.user?.id)

  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const [activeGroup, setActiveGroup] = useState<CommandKSegment>("buy")
  const [products, setProducts] = useState<ProductHit[]>([])
  const [preview, setPreview] = useState<ProductHit | null>(null)

  const catalog = useMemo(() => buildCommandKCatalog(role, loggedIn), [role, loggedIn])
  const items: ResolvedItem[] = useMemo(
    () => catalog.map((i) => ({ ...i, label: t(i.labelKey) })),
    [catalog, t]
  )

  const filtered = useMemo(() => {
    const needle = q.trim()
    return rankByFuzzy(items, needle, (item) =>
      [item.label, ...item.keywords, t(COMMAND_K_SEGMENT_LABEL_KEYS[item.segment])].join(" ")
    ).map(({ fuzzyRank: _r, ...item }) => item)
  }, [items, q, t])

  const bySegment = useMemo(() => {
    const map: Record<CommandKSegment, ResolvedItem[]> = { buy: [], sell: [], account: [] }
    for (const item of filtered) map[item.segment].push(item)
    return map
  }, [filtered])

  const fetchProducts = useDebouncedCallback(async (needle: string) => {
    if (needle.length < 2) {
      setProducts([])
      return
    }
    try {
      const res = await fetch(`/api/marketplace/products?q=${encodeURIComponent(needle)}`)
      const data = (await res.json()) as { products?: ProductHit[] }
      setProducts((data.products ?? []).slice(0, 6))
    } catch {
      setProducts([])
    }
  }, 280)

  useEffect(() => {
    fetchProducts(q.trim())
  }, [q, fetchProducts])

  const prefix = (href: string) => {
    if (
      href.startsWith("http") ||
      href.startsWith("/dashboard") ||
      href.startsWith("/login") ||
      href.startsWith("/signup") ||
      href.startsWith("/cart") ||
      href.startsWith("/wishlist") ||
      href.startsWith("/marketplace") ||
      href.startsWith("/shops")
    ) {
      return href
    }
    if (href === "/" || href === "/home") return `/${locale}`
    if (href.startsWith("/creators") || href.startsWith("/partners") || href.startsWith("/enterprise")) {
      return `/${locale}${href}`
    }
    return href
  }

  const runNav = useCallback(
    (item: ResolvedItem) => {
      setOpen(false)
      setQ("")
      if (item.action === "signOut") {
        void signOut({ callbackUrl: `/${locale}` })
        return
      }
      if (item.href) router.push(prefix(item.href))
    },
    [router, locale]
  )

  const runProduct = useCallback(
    (p: ProductHit) => {
      setOpen(false)
      setQ("")
      if (p.storeSlug) router.push(shopListingPath(p.storeSlug, p.id))
      else router.push(`/shops/browse?q=${encodeURIComponent(p.name)}`)
    },
    [router]
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((o) => !o)
      }
      if (e.key === "Escape") setOpen(false)
    }
    const onOpenEvent = () => setOpen(true)
    window.addEventListener("keydown", onKey)
    window.addEventListener(COMMAND_K_OPEN_EVENT, onOpenEvent)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener(COMMAND_K_OPEN_EVENT, onOpenEvent)
    }
  }, [])

  const groups = (["buy", "sell", "account"] as const).filter((s) => bySegment[s].length > 0)

  return (
    <>
      {showTrigger ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border border-zinc-200/90 bg-zinc-50/90 px-2.5 py-1.5 text-xs font-medium shadow-sm transition hover:border-violet-300 dark:border-zinc-700 dark:bg-zinc-900/80 sm:px-3"
          aria-label={`${t("triggerLabel")} (⌘K)`}
        >
          <Zap className="h-3.5 w-3.5 text-[#6366F1]" aria-hidden />
          <span className="hidden xl:inline">{t("triggerLabel")}</span>
          <kbd className="rounded-md border px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
        </button>
      ) : null}

      <AnimatePresence>
        {open ? (
          <motion.div
            className="fixed inset-0 z-[300] flex items-start justify-center bg-zinc-900/40 p-4 pt-[10vh] backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="flex w-full max-w-3xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-950"
              onClick={(e) => e.stopPropagation()}
            >
              <Command className="flex min-w-0 flex-1 flex-col" label={t("triggerLabel")} shouldFilter={false}>
                <div className="flex items-center gap-2 border-b px-4 py-3 dark:border-zinc-800">
                  <Search className="h-4 w-4 text-zinc-400" aria-hidden />
                  <Command.Input
                    value={q}
                    onValueChange={setQ}
                    placeholder={t("placeholder")}
                    className="flex-1 bg-transparent text-sm outline-none"
                  />
                  <kbd className="text-[10px] text-zinc-400">{t("escape")}</kbd>
                </div>
                <div className="flex gap-1 border-b px-2 py-1 dark:border-zinc-800">
                  {groups.map((seg) => {
                    const Icon = SEGMENT_ICONS[seg]
                    return (
                      <button
                        key={seg}
                        type="button"
                        tabIndex={0}
                        onClick={() => setActiveGroup(seg)}
                        onKeyDown={(e) => {
                          if (e.key === "Tab") {
                            e.preventDefault()
                            const i = groups.indexOf(activeGroup)
                            setActiveGroup(groups[(i + 1) % groups.length] ?? seg)
                          }
                        }}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold uppercase",
                          activeGroup === seg
                            ? "bg-[#6366F1] text-white"
                            : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                        )}
                      >
                        <Icon className="h-3 w-3" />
                        {t(COMMAND_K_SEGMENT_LABEL_KEYS[seg])}
                      </button>
                    )
                  })}
                </div>
                <Command.List className="max-h-[min(50vh,360px)] overflow-y-auto p-2">
                  <Command.Empty className="py-8 text-center text-sm text-zinc-500">
                    {t("empty")}
                  </Command.Empty>
                  {bySegment[activeGroup].map((item) => (
                    <Command.Item
                      key={item.id}
                      value={item.id}
                      onSelect={() => runNav(item)}
                      className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-sm aria-selected:bg-[#6366F1] aria-selected:text-white"
                    >
                      <Highlight text={item.label} query={q} />
                    </Command.Item>
                  ))}
                  {products.length > 0 ? (
                    <Command.Group heading={t("productsGroup")}>
                      {products.map((p) => (
                        <Command.Item
                          key={p.id}
                          value={`p-${p.id}`}
                          onSelect={() => runProduct(p)}
                          onMouseEnter={() => setPreview(p)}
                          className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm aria-selected:bg-[#6366F1] aria-selected:text-white"
                        >
                          {p.image ? (
                            <Image src={p.image} alt="" width={32} height={32} className="h-8 w-8 rounded-lg object-cover" />
                          ) : (
                            <span className="h-8 w-8 rounded-lg bg-zinc-200" />
                          )}
                          <Highlight text={p.name} query={q} />
                        </Command.Item>
                      ))}
                    </Command.Group>
                  ) : null}
                </Command.List>
              </Command>
              {preview?.image ? (
                <aside className="hidden w-40 border-l p-3 dark:border-zinc-800 sm:block">
                  <Image src={preview.image} alt={preview.name} width={140} height={140} className="rounded-xl object-cover" />
                  <p className="mt-2 line-clamp-2 text-xs font-medium">{preview.name}</p>
                </aside>
              ) : null}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}
