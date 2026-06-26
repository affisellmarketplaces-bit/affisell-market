"use client"

import { useCallback, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronRight, FileEdit, PlusCircle } from "lucide-react"
import { toast } from "sonner"

import { BentoStat } from "@/components/affisell/bento-ui"
import { SupplierDeleteDraftButton } from "@/components/supplier/supplier-delete-draft-button"
import { SupplierDraftBulkToolbar } from "@/components/supplier/supplier-draft-bulk-toolbar"
import { useSupplierDraftSelection } from "@/components/supplier/use-supplier-draft-selection"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { buttonVariants } from "@/components/ui/button"
import { bulkDeleteSupplierDraftsClient } from "@/lib/supplier-delete-drafts-client"
import { cn } from "@/lib/utils"

export type SupplierDraftPickRow = {
  id: string
  name: string
  imageUrl: string | null
  updatedAt: string
}

type Props = {
  draftCount: number
  drafts: SupplierDraftPickRow[]
}

function formatDraftDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  } catch {
    return ""
  }
}

export function SupplierDraftsStatPicker({ drafts }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [removedIds, setRemovedIds] = useState<Set<string>>(() => new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const visibleDrafts = useMemo(
    () => drafts.filter((d) => !removedIds.has(d.id)),
    [drafts, removedIds]
  )
  const visibleCount = visibleDrafts.length
  const visibleIds = useMemo(() => visibleDrafts.map((d) => d.id), [visibleDrafts])

  const {
    selectedIds,
    visibleSelectedCount,
    allSelected,
    toggle,
    selectAll,
    clearSelection,
    removeFromSelection,
  } = useSupplierDraftSelection(visibleIds)

  const handleBulkDelete = useCallback(async () => {
    const ids = visibleIds.filter((id) => selectedIds.has(id))
    if (ids.length === 0) return

    const label =
      ids.length === 1
        ? "Supprimer ce brouillon ? Cette action est irréversible."
        : `Supprimer ${ids.length} brouillons ? Cette action est irréversible.`
    if (!window.confirm(label)) return

    setBulkDeleting(true)
    try {
      const result = await bulkDeleteSupplierDraftsClient(ids)
      if (result.error && result.deleted.length === 0) {
        toast.error(result.error)
        return
      }

      if (result.deleted.length > 0) {
        setRemovedIds((prev) => {
          const next = new Set(prev)
          for (const id of result.deleted) next.add(id)
          return next
        })
        removeFromSelection(result.deleted)
        toast.success(
          result.deleted.length === 1
            ? "1 brouillon supprimé."
            : `${result.deleted.length} brouillons supprimés.`
        )
      }

      if (result.skipped.length > 0) {
        toast.message(
          `${result.skipped.length} brouillon${result.skipped.length > 1 ? "s" : ""} ignoré${result.skipped.length > 1 ? "s" : ""}.`
        )
      }

      router.refresh()
    } finally {
      setBulkDeleting(false)
    }
  }, [removeFromSelection, router, selectedIds, visibleIds])

  const statClassName =
    "border-0 bg-transparent p-0 shadow-none backdrop-blur-none dark:bg-transparent"

  if (visibleCount === 0) {
    return (
      <BentoStat
        className={statClassName}
        label="Drafts"
        value={0}
        hint="Finish and publish when you are ready"
      />
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group w-full rounded-2xl text-left transition",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950",
          "hover:bg-violet-50/60 dark:hover:bg-violet-950/25"
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <BentoStat
          className={cn(statClassName, "pointer-events-none")}
          label="Drafts"
          value={visibleCount}
          valueClassName="group-hover:text-violet-700 dark:group-hover:text-violet-300"
          hint={
            <span className="inline-flex items-center gap-1 text-violet-700 dark:text-violet-400">
              Choose a draft to continue
              <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden />
            </span>
          }
        />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex flex-col gap-0 p-0">
          <div className="border-b border-zinc-200 px-5 py-5 dark:border-zinc-800">
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
              Draft listings
            </p>
            <h2 className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-50">Continue a product</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Pick a draft to resume editing, then publish when you are ready.
            </p>
            <SupplierDraftBulkToolbar
              className="mt-4"
              totalCount={visibleCount}
              selectedCount={visibleSelectedCount}
              allSelected={allSelected}
              onSelectAll={selectAll}
              onClearSelection={clearSelection}
              onBulkDelete={() => void handleBulkDelete()}
              deleting={bulkDeleting}
            />
          </div>

          <ul className="flex-1 overflow-y-auto p-3">
            {visibleDrafts.length === 0 ? (
              <li className="px-3 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                Aucun brouillon — créez une nouvelle fiche.
              </li>
            ) : null}
            {visibleDrafts.map((draft) => {
              const href = `/dashboard/supplier/products/new?compose=1&draft=${encodeURIComponent(draft.id)}`
              const label = draft.name.trim() || "Brouillon sans titre"
              const isSelected = selectedIds.has(draft.id)
              return (
                <li
                  key={draft.id}
                  className={cn(
                    "mb-1 flex items-center gap-1 rounded-xl",
                    isSelected && "bg-violet-50/80 dark:bg-violet-950/30"
                  )}
                >
                  <label
                    className="flex shrink-0 cursor-pointer items-center px-2 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(draft.id)}
                      className="size-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-500/40 dark:border-zinc-600"
                      aria-label={`Sélectionner ${label}`}
                    />
                  </label>
                  <Link
                    href={href}
                    onClick={() => setOpen(false)}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-transparent px-1 py-3 transition hover:border-violet-200 hover:bg-violet-50/80 dark:hover:border-violet-900/50 dark:hover:bg-violet-950/40"
                  >
                    <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                      {draft.imageUrl ? (
                        <Image
                          src={draft.imageUrl}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="56px"
                          unoptimized={
                            draft.imageUrl.startsWith("data:") ||
                            draft.imageUrl.startsWith("http://") ||
                            draft.imageUrl.startsWith("https://")
                          }
                        />
                      ) : (
                        <FileEdit className="h-6 w-6 text-zinc-400" aria-hidden />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        {label}
                      </span>
                      {draft.updatedAt ? (
                        <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                          Updated {formatDraftDate(draft.updatedAt)}
                        </span>
                      ) : null}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
                  </Link>
                  <SupplierDeleteDraftButton
                    productId={draft.id}
                    productName={label}
                    variant="icon"
                    className="mr-1"
                    onDeleted={() => {
                      setRemovedIds((prev) => new Set(prev).add(draft.id))
                      removeFromSelection([draft.id])
                      router.refresh()
                    }}
                  />
                </li>
              )
            })}
          </ul>

          <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
            <Link
              href="/dashboard/supplier/products/new"
              onClick={() => setOpen(false)}
              className={cn(buttonVariants({ variant: "outline", size: "default" }), "w-full justify-center gap-2")}
            >
              <PlusCircle className="h-4 w-4" aria-hidden />
              New listing
            </Link>
            <Link
              href="/dashboard/supplier/products?drafts=1"
              onClick={() => setOpen(false)}
              className="mt-2 block text-center text-xs font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-400"
            >
              View all in catalog
            </Link>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
