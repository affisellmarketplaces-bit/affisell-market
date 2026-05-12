"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ChevronRight,
  Link2,
  LogOut,
  Package,
  Plus,
  RefreshCw,
  Sparkles,
  Store,
  Upload,
  UserRound,
} from "lucide-react"
import { signOut } from "next-auth/react"

import { BentoShell, BentoStat } from "@/components/affisell/bento-ui"
import { buttonVariants } from "@/components/ui/button"
import { formatStoreDateTime } from "@/lib/market-config"
import { cn } from "@/lib/utils"

type Props = {
  onStartManual: () => void
  onStartWithAssist: () => void
}

const cardBase =
  "group flex h-full flex-col rounded-3xl border border-gray-100 bg-white/80 p-6 text-left shadow-sm backdrop-blur-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950/75 md:p-8"

export function SupplierProductAddHub({ onStartManual, onStartWithAssist }: Props) {
  const router = useRouter()
  const [latestDraft, setLatestDraft] = useState<{
    id: string
    name: string
    updatedAt?: string
  } | null>(null)

  useEffect(() => {
    let cancel = false
    void fetch("/api/supplier/products", { credentials: "include" })
      .then((r) => r.json())
      .then((rows: unknown) => {
        if (cancel || !Array.isArray(rows)) return
        const drafts = rows
          .filter(
            (row): row is Record<string, unknown> =>
              row !== null &&
              typeof row === "object" &&
              Boolean((row as Record<string, unknown>).isDraft) &&
              typeof (row as Record<string, unknown>).id === "string"
          )
          .sort(
            (a, b) =>
              new Date(String(b.updatedAt ?? 0)).getTime() -
              new Date(String(a.updatedAt ?? 0)).getTime()
          )
        const row = drafts[0]
        if (!row) return
        const id = String(row.id)
        const name = typeof row.name === "string" ? row.name : "Untitled draft"
        setLatestDraft({
          id,
          name,
          updatedAt:
            typeof row.updatedAt === "string"
              ? row.updatedAt
              : row.updatedAt instanceof Date
                ? row.updatedAt.toISOString()
                : undefined,
        })
      })
      .catch(() => {})
    return () => {
      cancel = true
    }
  }, [])

  const quickLinks = [
    { label: "My catalog", href: "/dashboard/supplier/products", Icon: Package },
    { label: "Store profile", href: "/dashboard/supplier/settings/store", Icon: Store },
    { label: "Storefront look", href: "/dashboard/supplier/storefront", Icon: Sparkles },
    { label: "Account & security", href: "/dashboard/settings/account", Icon: UserRound },
  ] as const

  return (
    <BentoShell>
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">
        <header className="relative overflow-hidden rounded-3xl border border-violet-200/60 bg-white/85 shadow-sm shadow-violet-500/5 ring-1 ring-black/[0.03] backdrop-blur-md dark:border-violet-900/40 dark:bg-zinc-950/75 dark:ring-white/10">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.45] dark:opacity-[0.2]"
            style={{
              backgroundImage: `
                radial-gradient(ellipse 80% 55% at 15% -10%, rgba(139,92,246,0.28), transparent 50%),
                radial-gradient(ellipse 60% 45% at 92% 8%, rgba(20,184,166,0.2), transparent 45%),
                radial-gradient(circle at 50% 100%, rgba(139,92,246,0.06), transparent 55%)
              `,
            }}
            aria-hidden
          />
          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1 space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-violet-200/80 bg-violet-50/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-violet-800 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-200">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  Supplier hub
                </div>
                <div>
                  <h1 className="text-balance text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
                    Add products
                  </h1>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 sm:text-[15px]">
                    Choose how you build your catalog—manual listing, bulk Excel, URL import, or AI-assisted drafts.
                    Everything stays private until you publish.
                  </p>
                </div>
                <nav className="flex flex-wrap gap-2 sm:gap-2.5" aria-label="Quick links">
                  {quickLinks.map(({ label, href, Icon }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => router.push(href)}
                      className="group inline-flex items-center gap-2 rounded-xl border border-zinc-200/90 bg-white/90 px-3.5 py-2 text-left text-[13px] font-medium text-zinc-800 shadow-sm transition hover:border-violet-300/70 hover:bg-violet-50/50 hover:text-violet-900 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100 dark:hover:border-violet-700 dark:hover:bg-violet-950/40 dark:hover:text-violet-100"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-100 to-teal-50 text-violet-700 dark:from-violet-950 dark:to-teal-950/50 dark:text-violet-300">
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1 truncate">{label}</span>
                      <ChevronRight
                        className="h-4 w-4 shrink-0 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-violet-600 dark:group-hover:text-violet-400"
                        aria-hidden
                      />
                    </button>
                  ))}
                </nav>
              </div>
              <div className="flex w-full shrink-0 flex-col gap-2 sm:flex-row lg:w-auto lg:flex-col xl:max-w-[280px]">
                <Link
                  href="/dashboard/supplier/products"
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
                >
                  <Package className="h-4 w-4 shrink-0" aria-hidden />
                  View my catalog
                </Link>
                <button
                  type="button"
                  onClick={() => void signOut({ callbackUrl: "/" })}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <LogOut className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                  Sign out
                </button>
              </div>
            </div>

            <div className="mt-8 grid gap-6 border-t border-gray-100/90 pt-8 dark:border-zinc-800 sm:grid-cols-3">
              <BentoStat
                className="border-0 bg-transparent p-0 shadow-none backdrop-blur-none dark:bg-transparent"
                label="Ways to add"
                value="4"
                hint="Manual card, bulk Excel, URL import, AI assist"
              />
              <BentoStat
                className="border-0 bg-transparent p-0 shadow-none backdrop-blur-none dark:bg-transparent"
                label="Draft on file"
                value={latestDraft ? "1" : "0"}
                hint={
                  latestDraft ? (
                    <>
                      <Link
                        href={`/dashboard/supplier/products/new?compose=1&draft=${encodeURIComponent(latestDraft.id)}`}
                        className="font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-400"
                      >
                        Resume “{latestDraft.name.slice(0, 28)}
                        {latestDraft.name.length > 28 ? "…" : ""}”
                      </Link>
                      {latestDraft.updatedAt ? (
                        <> · last saved {formatStoreDateTime(latestDraft.updatedAt)}</>
                      ) : null}
                    </>
                  ) : (
                    "Start a listing—drafts save automatically."
                  )
                }
              />
              <BentoStat
                className="border-0 bg-transparent p-0 shadow-none backdrop-blur-none dark:bg-transparent"
                label="At scale"
                value="Excel"
                hint="Category attributes & validation before publish"
                valueClassName="text-[#10B981] dark:text-emerald-400"
              />
            </div>
          </div>
        </header>

        <p className="mt-8 text-sm text-gray-600 dark:text-zinc-400">
          Pick a card below—each path opens the right tool for your workflow.
        </p>

        <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <li className="lg:col-span-1">
            <button
              type="button"
              onClick={onStartManual}
              className={cn(
                cardBase,
                "relative overflow-hidden border-teal-200/90 bg-gradient-to-br from-teal-50/90 via-cyan-50/50 to-white ring-1 ring-teal-500/15 dark:border-teal-900/50 dark:from-teal-950/40 dark:via-cyan-950/15 dark:to-zinc-950 dark:ring-teal-500/20"
              )}
            >
              <span
                className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-teal-400/20 blur-2xl dark:bg-teal-500/15"
                aria-hidden
              />
              <div className="relative flex h-full flex-col">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white shadow-lg shadow-teal-600/25">
                  <Plus className="h-5 w-5" strokeWidth={2.5} aria-hidden />
                </span>
                <h2 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Add individual products
                </h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  Titles, descriptions, category, and images—full control. Use the other cards for imports or AI
                  assist.
                </p>
                <span
                  className={cn(
                    buttonVariants({ variant: "bentoSolid", size: "bento" }),
                    "mt-6 w-full justify-center bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500"
                  )}
                >
                  Start manual listing
                </span>
              </div>
            </button>
          </li>

          <li>
            <Link
              href="/dashboard/supplier/bulk-import"
              className={cn(cardBase, "hover:border-violet-200/80 dark:hover:border-violet-800/60")}
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                <Upload className="h-5 w-5" aria-hidden />
              </span>
              <h2 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Bulk import</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Structured Excel with category attributes—validate rows before publishing.
              </p>
              <span className="mt-6 text-sm font-medium text-violet-700 group-hover:underline dark:text-violet-400">
                Open bulk import →
              </span>
            </Link>
          </li>

          <li>
            <Link
              href="/dashboard/supplier/integrations"
              className={cn(cardBase, "hover:border-violet-200/80 dark:hover:border-violet-800/60")}
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                <RefreshCw className="h-5 w-5" aria-hidden />
              </span>
              <h2 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Platform sync</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Shopify or secure webhook—pull catalog updates as drafts.
              </p>
              <span className="mt-6 text-sm font-medium text-violet-700 group-hover:underline dark:text-violet-400">
                Configure integrations →
              </span>
            </Link>
          </li>

          <li>
            <Link
              href="/dashboard/supplier/import"
              className={cn(cardBase, "hover:border-violet-200/80 dark:hover:border-violet-800/60")}
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                <Link2 className="h-5 w-5" aria-hidden />
              </span>
              <h2 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Import from URL</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Paste a product page URL to pre-fill your listing fields.
              </p>
              <span className="mt-6 text-sm font-medium text-violet-700 group-hover:underline dark:text-violet-400">
                Open URL import →
              </span>
            </Link>
          </li>

          <li className="sm:col-span-2 lg:col-span-2">
            <button
              type="button"
              onClick={onStartWithAssist}
              className={cn(
                cardBase,
                "w-full border-violet-200/80 bg-gradient-to-br from-violet-50/90 to-white dark:border-violet-900/40 dark:from-violet-950/35 dark:to-zinc-950"
              )}
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white shadow-md shadow-violet-600/20">
                <Sparkles className="h-5 w-5" aria-hidden />
              </span>
              <h2 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Draft with AI & shortcuts</h2>
              <p className="mt-2 text-left text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Opens the editor with URL import and AI panels at the top—get a head start, then refine everything
                before publish.
              </p>
              <span
                className={cn(
                  buttonVariants({ variant: "bentoAccent", size: "bento" }),
                  "mt-6 w-full justify-center sm:w-auto"
                )}
              >
                Continue to editor
                <ChevronRight className="size-4 opacity-90" aria-hidden />
              </span>
            </button>
          </li>
        </ul>
      </div>
    </BentoShell>
  )
}
