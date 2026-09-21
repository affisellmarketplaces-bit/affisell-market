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
  /** What the classifier understood — drives the "photo and title disagree" warning. */
  identity?: { name: string; photoShows: string; photoTitleConflict: boolean; confidence: number } | null
}

/** Photo-based scans call an AI classifier and can legitimately take several seconds. */
const SLOW_HINT_MS = 6000
/** Past this, stop waiting and let the supplier retry rather than spin forever. */
const HARD_TIMEOUT_MS = 25000

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
  const [slow, setSlow] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [retryNonce, setRetryNonce] = useState(0)

  const retry = () => setRetryNonce((n) => n + 1)

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
      setSlow(false)
      setTimedOut(false)
      return
    }

    const ac = new AbortController()
    setLoading(true)
    setSlow(false)
    setTimedOut(false)

    const slowTimer = setTimeout(() => setSlow(true), SLOW_HINT_MS)
    const hardTimer = setTimeout(() => {
      setTimedOut(true)
      setLoading(false)
      ac.abort()
    }, HARD_TIMEOUT_MS)

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
          identity?: SupplierCategorySuggestMeta["identity"]
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
          identity: data.identity ?? null,
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
        clearTimeout(slowTimer)
        clearTimeout(hardTimer)
        if (!ac.signal.aborted) setLoading(false)
      }
    })()

    return () => {
      clearTimeout(slowTimer)
      clearTimeout(hardTimer)
      ac.abort()
    }
  }, [browse, debouncedTitle, debouncedDescription, debouncedBullets, debouncedImageUrl, retryNonce])

  return { suggestions, alternatives, productInsight, loading, slow, timedOut, retry, meta }
}
