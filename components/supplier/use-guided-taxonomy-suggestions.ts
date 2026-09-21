"use client"

import { useEffect, useState } from "react"
import { useDebounce } from "use-debounce"

import type { LeafPath } from "@/lib/category-browse-shared"
import { hasListingClassificationSignal, isDurableListingImageUrl } from "@/lib/supplier-auto-category-policy"

export type GuidedTaxonomySuggestion = LeafPath & { confidence?: number }

const HARD_TIMEOUT_MS = 25_000

/**
 * Title + photo → exact leaf categories of the REAL taxonomy (same engine as the full product form:
 * catalogue learning, keywords, vision). The 4-bucket picker of the guided wizard stays as the coarse shelf.
 */
export function useGuidedTaxonomySuggestions(title: string, imageUrl: string | null, enabled: boolean) {
  const [debouncedTitle] = useDebounce(title.trim(), 500)
  const [debouncedImage] = useDebounce(imageUrl ?? "", 450)
  const [suggestions, setSuggestions] = useState<GuidedTaxonomySuggestion[]>([])
  const [recommendedLeafId, setRecommendedLeafId] = useState<string | null>(null)
  const [autoApply, setAutoApply] = useState(false)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [retryNonce, setRetryNonce] = useState(0)

  useEffect(() => {
    const durable = isDurableListingImageUrl(debouncedImage.trim()) ? debouncedImage.trim() : undefined
    if (!enabled || !hasListingClassificationSignal(debouncedTitle, durable)) {
      setSuggestions([])
      setRecommendedLeafId(null)
      setAutoApply(false)
      setLoading(false)
      setFailed(false)
      return
    }

    const ac = new AbortController()
    let cancelled = false
    let timedOut = false
    const hard = setTimeout(() => {
      timedOut = true
      ac.abort()
    }, HARD_TIMEOUT_MS)
    setLoading(true)
    setFailed(false)
    void (async () => {
      try {
        const res = await fetch("/api/supplier/suggest-listing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          signal: ac.signal,
          body: JSON.stringify({ title: debouncedTitle, imageUrl: durable }),
        })
        if (!res.ok) throw new Error(String(res.status))
        const data = (await res.json()) as {
          suggestions?: GuidedTaxonomySuggestion[]
          recommendedLeafId?: string | null
          autoApplyRecommended?: boolean
        }
        if (cancelled) return
        setSuggestions(Array.isArray(data.suggestions) ? data.suggestions.slice(0, 4) : [])
        setRecommendedLeafId(typeof data.recommendedLeafId === "string" ? data.recommendedLeafId : null)
        setAutoApply(Boolean(data.autoApplyRecommended))
      } catch {
        // A newer request (or unmount) superseded this one: not an error. Only a real failure/timeout is shown.
        if (cancelled && !timedOut) return
        setSuggestions([])
        setRecommendedLeafId(null)
        setAutoApply(false)
        setFailed(true)
      } finally {
        clearTimeout(hard)
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      clearTimeout(hard)
      ac.abort()
    }
  }, [enabled, debouncedTitle, debouncedImage, retryNonce])

  return { suggestions, recommendedLeafId, autoApply, loading, failed, retry: () => setRetryNonce((n) => n + 1) }
}
