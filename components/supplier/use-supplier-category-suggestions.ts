"use client"

import { useEffect, useState } from "react"
import { useDebounce } from "use-debounce"

import type { LeafPath } from "@/lib/category-browse"

import type { BrowsePayload } from "./supplier-category-picker"

/** Single source: Groq + keyword merge via `/api/supplier/suggest-categories-ai`. */
export function useSupplierCategorySuggestions(
  title: string,
  description: string,
  browse: BrowsePayload | null
) {
  const [debouncedTitle] = useDebounce(title, 500)
  const [debouncedDescription] = useDebounce(description, 500)
  const [suggestions, setSuggestions] = useState<LeafPath[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const t = debouncedTitle.trim()
    if (!browse || t.length < 3) {
      setSuggestions([])
      setLoading(false)
      return
    }

    const ac = new AbortController()
    setLoading(true)

    void (async () => {
      try {
        const res = await fetch("/api/supplier/suggest-categories-ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: t,
            description: debouncedDescription.trim(),
          }),
          signal: ac.signal,
        })
        if (!res.ok) {
          setSuggestions([])
          return
        }
        const data = (await res.json()) as { suggestions?: LeafPath[] }
        setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : [])
      } catch (e) {
        if ((e as Error).name !== "AbortError") setSuggestions([])
      } finally {
        if (!ac.signal.aborted) setLoading(false)
      }
    })()

    return () => ac.abort()
  }, [browse, debouncedTitle, debouncedDescription])

  return { suggestions, loading }
}
