"use client"

import { Loader2, Sparkles } from "lucide-react"
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { useDebounce } from "use-debounce"
import { toast } from "sonner"

import type { BrowsePayload } from "@/components/supplier/supplier-category-picker"
import { pathFromLeafId, type CategoryPathSegment } from "@/lib/category-browse"
import { cn } from "@/lib/utils"

export type ClassifyApiSuggestion = {
  category: string
  confidence: number
  reason: string
  leafId: string | null
}

type Props = {
  title: string
  description: string
  imageUrl?: string | null
  browse: BrowsePayload | null
  categoryId: string
  onChange: (leafId: string, path: CategoryPathSegment[]) => void
  /** Fires when a suggestion is applied (auto or click). */
  onAiTagged?: () => void
}

export function CategoryAutosuggest({
  title,
  description,
  imageUrl,
  browse,
  categoryId,
  onChange,
  onAiTagged,
}: Props) {
  const [debouncedTitle] = useDebounce(title, 600)
  const [debouncedDescription] = useDebounce(description, 600)
  const [debouncedImage] = useDebounce(imageUrl ?? "", 600)

  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<ClassifyApiSuggestion[]>([])
  const lastAutoKey = useRef<string | null>(null)
  const categoryIdRef = useRef(categoryId)
  const onChangeRef = useRef(onChange)
  const onAiTaggedRef = useRef(onAiTagged)

  useLayoutEffect(() => {
    categoryIdRef.current = categoryId
    onChangeRef.current = onChange
    onAiTaggedRef.current = onAiTagged
  }, [categoryId, onChange, onAiTagged])

  const applySuggestion = useCallback((row: ClassifyApiSuggestion, mode: "auto" | "click") => {
    if (!browse || !row.leafId) return
    const path = pathFromLeafId(row.leafId, browse.nodes)
    if (!path?.length) return
    onChangeRef.current(row.leafId, path)
    onAiTaggedRef.current?.()
    if (mode === "auto") {
      toast.success("Catégorie suggérée par IA")
    }
  }, [browse])

  useEffect(() => {
    const trimmedTitle = debouncedTitle.trim()
    if (trimmedTitle.length <= 3 || /^https?:\/\//i.test(trimmedTitle)) {
      setSuggestions([])
      setLoading(false)
      return
    }

    const ac = new AbortController()
    setLoading(true)
    void (async () => {
      try {
        const res = await fetch("/api/products/classify-category", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ac.signal,
          body: JSON.stringify({
            title: debouncedTitle.trim(),
            description: debouncedDescription.trim(),
            ...(debouncedImage.trim() ? { imageUrl: debouncedImage.trim() } : {}),
          }),
        })
        if (ac.signal.aborted) return
        const data = (await res.json()) as {
          suggestions?: ClassifyApiSuggestion[]
          error?: string
        }
        if (ac.signal.aborted) return
        const next = Array.isArray(data.suggestions) ? data.suggestions : []
        setSuggestions(next)

        const visible = next.filter((s) => s.confidence > 0.6 && s.leafId)
        const top = visible[0]
        if (top && top.confidence > 0.9 && browse) {
          const key = `${debouncedTitle.trim()}|${debouncedDescription.trim()}|${top.leafId}`
          if (lastAutoKey.current !== key && top.leafId !== categoryIdRef.current) {
            lastAutoKey.current = key
            applySuggestion(top, "auto")
          }
        }
      } catch {
        if (!ac.signal.aborted) setSuggestions([])
      } finally {
        if (!ac.signal.aborted) setLoading(false)
      }
    })()

    return () => ac.abort()
  }, [debouncedTitle, debouncedDescription, debouncedImage, browse, applySuggestion])

  const chips = suggestions.filter((s) => s.confidence > 0.6 && s.leafId)

  const trimmedTitle = debouncedTitle.trim()
  if (trimmedTitle.length <= 3 || /^https?:\/\//i.test(trimmedTitle)) return null

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        {loading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
            <span>Analyse IA de la catégorie…</span>
          </>
        ) : (
          <span className="inline-flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-500" aria-hidden />
            Suggestions catégorie (IA)
          </span>
        )}
      </div>
      {chips.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {chips.slice(0, 3).map((s) => (
            <button
              key={`${s.leafId}-${s.category}`}
              type="button"
              onClick={() => applySuggestion(s, "click")}
              className={cn(
                "max-w-full rounded-full border px-3 py-1.5 text-left text-xs font-medium transition",
                s.leafId === categoryId
                  ? "border-violet-600 bg-violet-50 text-violet-950 dark:border-violet-500 dark:bg-violet-950/50 dark:text-violet-100"
                  : "border-zinc-200 bg-white text-zinc-800 hover:border-violet-400 hover:bg-violet-50/50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-violet-600"
              )}
              title={s.reason}
            >
              <span className="line-clamp-2">{s.category}</span>{" "}
              <span className="tabular-nums text-zinc-500 dark:text-zinc-400">
                ({Math.round(s.confidence * 100)}%)
              </span>
            </button>
          ))}
        </div>
      ) : loading ? null : (
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500">Aucune suggestion fiable pour le moment.</p>
      )}
    </div>
  )
}
