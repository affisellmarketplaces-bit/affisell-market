"use client"

import { useEffect, useState } from "react"
import { useDebounce } from "use-debounce"

import type { LeafPath } from "@/lib/category-browse"

import type { BrowsePayload } from "./supplier-category-picker"

export function useSupplierCategoryAiSuggestions(
  title: string,
  description: string,
  browse: BrowsePayload | null
) {
  const [debouncedTitle] = useDebounce(title, 500)
  const [debouncedDescription] = useDebounce(description, 500)
  const [aiSuggestions, setAiSuggestions] = useState<LeafPath[]>([])
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    const t = debouncedTitle.trim()
    if (!browse || t.length < 3) {
      setAiSuggestions([])
      setAiLoading(false)
      return
    }

    const ac = new AbortController()
    setAiLoading(true)

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
          setAiSuggestions([])
          return
        }
        const data = (await res.json()) as { suggestions?: LeafPath[] }
        setAiSuggestions(Array.isArray(data.suggestions) ? data.suggestions : [])
      } catch (e) {
        if ((e as Error).name !== "AbortError") setAiSuggestions([])
      } finally {
        if (!ac.signal.aborted) setAiLoading(false)
      }
    })()

    return () => ac.abort()
  }, [browse, debouncedTitle, debouncedDescription])

  return { aiSuggestions, aiLoading }
}
