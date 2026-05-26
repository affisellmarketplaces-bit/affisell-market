"use client"

import { useEffect, useState } from "react"
import { useDebounce } from "use-debounce"

import type { CategoryAlternativeSuggestion } from "@/lib/category-title-match"
import type { ListingProductInsight } from "@/lib/listing-product-signal"
import type { ListingCategorySuggestion } from "@/lib/supplier-suggest-listing"

import type { BrowsePayload } from "./supplier-category-picker"

/** Title-first suggestions via `/api/supplier/suggest-listing`. */
export function useSupplierCategorySuggestions(
  title: string,
  description: string,
  browse: BrowsePayload | null,
  imageUrl?: string | null
) {
  const [debouncedTitle] = useDebounce(title, 500)
  const [debouncedDescription] = useDebounce(description, 500)
  const [debouncedImageUrl] = useDebounce(imageUrl ?? "", 500)
  const [suggestions, setSuggestions] = useState<ListingCategorySuggestion[]>([])
  const [alternatives, setAlternatives] = useState<CategoryAlternativeSuggestion[]>([])
  const [productInsight, setProductInsight] = useState<ListingProductInsight | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const t = debouncedTitle.trim()
    if (!browse || t.length < 3) {
      setSuggestions([])
      setAlternatives([])
      setProductInsight(null)
      setLoading(false)
      return
    }

    const ac = new AbortController()
    setLoading(true)

    void (async () => {
      try {
        const image =
          debouncedImageUrl.trim().length > 0 ? debouncedImageUrl.trim() : undefined
        const res = await fetch("/api/supplier/suggest-listing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: t,
            description: debouncedDescription.trim(),
            imageUrl: image,
          }),
          signal: ac.signal,
        })
        if (!res.ok) {
          setSuggestions([])
          setAlternatives([])
          setProductInsight(null)
          return
        }
        const data = (await res.json()) as {
          suggestions?: ListingCategorySuggestion[]
          alternatives?: CategoryAlternativeSuggestion[]
          productInsight?: ListingProductInsight | null
        }
        setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : [])
        setAlternatives(Array.isArray(data.alternatives) ? data.alternatives : [])
        setProductInsight(data.productInsight ?? null)
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setSuggestions([])
          setAlternatives([])
          setProductInsight(null)
        }
      } finally {
        if (!ac.signal.aborted) setLoading(false)
      }
    })()

    return () => ac.abort()
  }, [browse, debouncedTitle, debouncedDescription, debouncedImageUrl])

  return { suggestions, alternatives, productInsight, loading }
}
