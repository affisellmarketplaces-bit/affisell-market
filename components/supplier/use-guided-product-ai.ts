"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useDebounce } from "use-debounce"

import {
  EMPTY_GUIDED_AI_SUGGESTION,
  type GuidedProductAiSuggestion,
} from "@/lib/guided-product-ai-shared"
import { isDurableListingImageUrl } from "@/lib/supplier-auto-category-policy"

type FetchInput = {
  title: string
  imageUrl: string | null
  imagePreview: string | null
}

export function useGuidedProductAi(input: FetchInput, enabled: boolean) {
  const [debouncedTitle] = useDebounce(input.title.trim(), 350)
  const [debouncedImageUrl] = useDebounce(input.imageUrl ?? "", 250)
  const [debouncedPreview] = useDebounce(input.imagePreview ?? "", 150)
  const [suggestion, setSuggestion] = useState<GuidedProductAiSuggestion>(EMPTY_GUIDED_AI_SUGGESTION)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  const fetchSuggestions = useCallback(async (signal?: AbortSignal) => {
    const durableImage = isDurableListingImageUrl(debouncedImageUrl) ? debouncedImageUrl.trim() : ""
    const previewDataUrl =
      !durableImage && debouncedPreview.startsWith("data:image/") ? debouncedPreview : undefined

    if (!debouncedTitle && !durableImage && !previewDataUrl) {
      setSuggestion(EMPTY_GUIDED_AI_SUGGESTION)
      setError(null)
      setLoading(false)
      return
    }

    const reqId = ++requestIdRef.current
    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/supplier/guided-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal,
        body: JSON.stringify({
          title: debouncedTitle,
          imageUrl: durableImage || undefined,
          imageDataUrl: previewDataUrl,
        }),
      })

      const data = (await res.json().catch(() => ({}))) as GuidedProductAiSuggestion & {
        error?: string
        detail?: string
      }

      if (!res.ok) {
        if (reqId === requestIdRef.current) {
          setError(data.detail ?? data.error ?? "IA indisponible")
          if (Array.isArray(data.categoryScores) && data.categoryScores.length > 0) {
            setSuggestion({ ...data, fallback: true, source: "fallback" })
          } else {
            setSuggestion({ ...EMPTY_GUIDED_AI_SUGGESTION, fallback: true, source: "fallback" })
          }
        }
        return
      }

      if (reqId === requestIdRef.current) {
        setSuggestion(data)
        setError(null)
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return
      if (reqId === requestIdRef.current) {
        setError("Connexion IA interrompue")
        setSuggestion({ ...EMPTY_GUIDED_AI_SUGGESTION, fallback: true, source: "fallback" })
      }
    } finally {
      if (reqId === requestIdRef.current) setLoading(false)
    }
  }, [debouncedImageUrl, debouncedPreview, debouncedTitle])

  useEffect(() => {
    if (!enabled) {
      setSuggestion(EMPTY_GUIDED_AI_SUGGESTION)
      setLoading(false)
      setError(null)
      return
    }

    const ac = new AbortController()
    void fetchSuggestions(ac.signal)
    return () => ac.abort()
  }, [enabled, fetchSuggestions])

  const refresh = useCallback(() => {
    void fetchSuggestions()
  }, [fetchSuggestions])

  return { suggestion, loading, error, refresh }
}
