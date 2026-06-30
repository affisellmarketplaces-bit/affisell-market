"use client"

import { useEffect, useState } from "react"
import { useDebounce } from "use-debounce"

import { hasListingClassificationSignal, isDurableListingImageUrl } from "@/lib/supplier-auto-category-policy"
import type { CategoryAlternativeSuggestion } from "@/lib/category-title-match"
import type { ListingProductInsight } from "@/lib/listing-product-signal"
import type { ListingCategorySuggestion } from "@/lib/supplier-suggest-listing"

import type { BrowsePayload } from "./supplier-category-picker"

export type SupplierCategorySuggestMeta = {
  recommendedLeafId: string | null
  autoApplyRecommended: boolean
  visionUsed: boolean
  suggestedProductName: string | null
  source: string
}

/** Title + main photo → live taxonomy suggestions (vision-first when both are set). */
export function useSupplierCategorySuggestions(
  title: string,
  description: string,
  bullets: string[],
  browse: BrowsePayload | null,
  imageUrl?: string | null
) {
  const [debouncedTitle] = useDebounce(title, 400)
  const [debouncedDescription] = useDebounce(description, 500)
  const [debouncedBullets] = useDebounce(bullets, 500)
  const [debouncedImageUrl] = useDebounce(imageUrl ?? "", 450)
  const [suggestions, setSuggestions] = useState<ListingCategorySuggestion[]>([])
  const [alternatives, setAlternatives] = useState<CategoryAlternativeSuggestion[]>([])
  const [productInsight, setProductInsight] = useState<ListingProductInsight | null>(null)
  const [meta, setMeta] = useState<SupplierCategorySuggestMeta>({
    recommendedLeafId: null,
    autoApplyRecommended: false,
    visionUsed: false,
    suggestedProductName: null,
    source: "none",
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const rawImage = debouncedImageUrl.trim()
    const durableImage = isDurableListingImageUrl(rawImage) ? rawImage : undefined
    if (!browse || !hasListingClassificationSignal(debouncedTitle, durableImage)) {
      setSuggestions([])
      setAlternatives([])
      setProductInsight(null)
      setMeta({
        recommendedLeafId: null,
        autoApplyRecommended: false,
        visionUsed: Boolean(durableImage),
        suggestedProductName: null,
        source: "none",
      })
      setLoading(false)
      return
    }

    const ac = new AbortController()
    setLoading(true)

    void (async () => {
      try {
        const res = await fetch("/api/supplier/suggest-listing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: debouncedTitle.trim(),
            description: debouncedDescription.trim(),
            bullets: debouncedBullets.filter((b) => b.trim().length > 0),
            imageUrl: durableImage,
          }),
          signal: ac.signal,
        })
        if (!res.ok) {
          setSuggestions([])
          setAlternatives([])
          setProductInsight(null)
          setMeta({
            recommendedLeafId: null,
            autoApplyRecommended: false,
            visionUsed: Boolean(durableImage),
            suggestedProductName: null,
            source: "none",
          })
          return
        }
        const data = (await res.json()) as {
          suggestions?: ListingCategorySuggestion[]
          alternatives?: CategoryAlternativeSuggestion[]
          productInsight?: ListingProductInsight | null
          recommendedLeafId?: string | null
          autoApplyRecommended?: boolean
          visionUsed?: boolean
          suggestedProductName?: string | null
          source?: string
        }
        setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : [])
        setAlternatives(Array.isArray(data.alternatives) ? data.alternatives : [])
        setProductInsight(data.productInsight ?? null)
        setMeta({
          recommendedLeafId:
            typeof data.recommendedLeafId === "string" ? data.recommendedLeafId : null,
          autoApplyRecommended: Boolean(data.autoApplyRecommended),
          visionUsed: Boolean(data.visionUsed),
          suggestedProductName:
            typeof data.suggestedProductName === "string" ? data.suggestedProductName : null,
          source: typeof data.source === "string" ? data.source : "none",
        })
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setSuggestions([])
          setAlternatives([])
          setProductInsight(null)
          setMeta({
            recommendedLeafId: null,
            autoApplyRecommended: false,
            visionUsed: false,
            suggestedProductName: null,
            source: "none",
          })
        }
      } finally {
        if (!ac.signal.aborted) setLoading(false)
      }
    })()

    return () => ac.abort()
  }, [browse, debouncedTitle, debouncedDescription, debouncedBullets, debouncedImageUrl])

  return { suggestions, alternatives, productInsight, loading, meta }
}
