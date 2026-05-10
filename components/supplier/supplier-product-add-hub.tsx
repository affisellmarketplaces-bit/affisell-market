"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Link2, Plus, RefreshCw, Sparkles, Upload } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  /** Full editor, manual fields only — URL/AI shortcuts live under “Draft with AI & shortcuts”. */
  onStartManual: () => void
  /** Same editor with optional URL import + AI panels at the top (assist mode). */
  onStartWithAssist: () => void
}

const cardBase =
  "group flex h-full flex-col rounded-2xl border p-6 text-left shadow-sm transition hover:shadow-md"

export function SupplierProductAddHub({ onStartManual, onStartWithAssist }: Props) {
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100/95 via-white to-zinc-50 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900/90">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
        <header className="mb-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
              Add products
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Choose how you want to build your catalog. Manual entry is the default path—precise,
              flexible, and ideal when you already have assets ready.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/supplier/products"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "border-zinc-300 dark:border-zinc-600"
              )}
            >
              Back to products
            </Link>
          </div>
        </header>

        {latestDraft ? (
          <div className="mb-6 rounded-2xl border border-violet-200/80 bg-gradient-to-r from-violet-50/90 to-white px-4 py-4 shadow-sm dark:border-violet-900/45 dark:from-violet-950/40 dark:to-zinc-950 sm:px-5">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Draft in progress · {latestDraft.name}
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Listing is saved privately—resume anytime. Last touch:{" "}
              {latestDraft.updatedAt
                ? new Date(latestDraft.updatedAt).toLocaleString("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "recent"}
            </p>
            <Link
              href={`/dashboard/supplier/products/new?compose=1&draft=${encodeURIComponent(latestDraft.id)}`}
              className={cn(
                buttonVariants({ variant: "secondary", size: "sm" }),
                "mt-3 inline-flex border-violet-200 bg-white hover:bg-violet-50 dark:border-violet-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
              )}
            >
              Resume draft →
            </Link>
          </div>
        ) : null}

        <p className="mb-8 text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Reference your products with the method that matches your workflow.
        </p>

        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {/* Primary: manual */}
          <li className="lg:col-span-1">
            <button
              type="button"
              onClick={onStartManual}
              className={cn(
                cardBase,
                "relative overflow-hidden border-teal-200/90 bg-gradient-to-br from-teal-50 via-cyan-50/80 to-white ring-1 ring-teal-500/15 dark:border-teal-900/50 dark:from-teal-950/40 dark:via-cyan-950/20 dark:to-zinc-950 dark:ring-teal-500/20"
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
                  Enter titles, descriptions, categories, and images yourself. For URL import or an
                  AI first draft, use the dedicated cards below instead.
                </p>
                <span
                  className={cn(
                    buttonVariants({ size: "default" }),
                    "mt-6 w-full bg-teal-600 text-white hover:bg-teal-700 dark:bg-teal-600 dark:hover:bg-teal-500"
                  )}
                >
                  Add a product
                </span>
              </div>
            </button>
          </li>

          <li>
            <Link
              href="/dashboard/supplier/bulk-import"
              className={cn(
                cardBase,
                "border-zinc-200/90 bg-white hover:border-zinc-300 dark:border-zinc-700/90 dark:bg-zinc-950/50 dark:hover:border-zinc-600"
              )}
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                <Upload className="h-5 w-5" aria-hidden />
              </span>
              <h2 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Bulk import</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Publish many SKUs at once using structured Excel templates and category attributes.
              </p>
              <span className="mt-6 text-sm font-medium text-teal-700 group-hover:underline dark:text-teal-400">
                Open bulk import →
              </span>
            </Link>
          </li>

          <li>
            <Link
              href="/dashboard/supplier/integrations"
              className={cn(
                cardBase,
                "border-zinc-200/90 bg-white hover:border-zinc-300 dark:border-zinc-700/90 dark:bg-zinc-950/50 dark:hover:border-zinc-600"
              )}
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                <RefreshCw className="h-5 w-5" aria-hidden />
              </span>
              <h2 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Platform sync
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Connect Shopify or a secure webhook to pull catalog updates and drafts.
              </p>
              <span className="mt-6 text-sm font-medium text-teal-700 group-hover:underline dark:text-teal-400">
                Configure integrations →
              </span>
            </Link>
          </li>

          <li>
            <Link
              href="/dashboard/supplier/import"
              className={cn(
                cardBase,
                "border-zinc-200/90 bg-white hover:border-zinc-300 dark:border-zinc-700/90 dark:bg-zinc-950/50 dark:hover:border-zinc-600"
              )}
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                <Link2 className="h-5 w-5" aria-hidden />
              </span>
              <h2 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Import from URL
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Precision import from a product page URL to pre-fill your listing.
              </p>
              <span className="mt-6 text-sm font-medium text-teal-700 group-hover:underline dark:text-teal-400">
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
                "w-full border-violet-200/80 bg-gradient-to-br from-violet-50/90 to-white dark:border-violet-900/40 dark:from-violet-950/30 dark:to-zinc-950"
              )}
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white shadow-md shadow-violet-600/20">
                <Sparkles className="h-5 w-5" aria-hidden />
              </span>
              <h2 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Draft with AI & shortcuts
              </h2>
              <p className="mt-2 text-left text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Opens the listing editor with URL import and AI assist at the top—best when you want a
                head start, then refine manually.
              </p>
              <span className="mt-4 text-sm font-medium text-violet-700 dark:text-violet-300">
                Continue to editor →
              </span>
            </button>
          </li>
        </ul>
      </div>
    </div>
  )
}
