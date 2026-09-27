"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import type { CategoryAttrRow } from "@/components/supplier/category-attribute-fields"
import {
  buildSmartScanPatch,
  buildSmartScanRequestBody,
  parseSmartScanResponse,
  shouldTriggerSmartScan,
  smartScanFingerprint,
  type SmartScanPatch,
} from "@/lib/supplier-smart-scan"

export type SmartScanStatus = "idle" | "scanning" | "done" | "skipped"

type Args = {
  categoryId: string
  categoryPathLabel: string
  name: string
  description: string
  images: string[]
  categoryAttrs: CategoryAttrRow[]
  /** Called only with values that are safe to write right now (description/price checked live). */
  onApply: (patch: SmartScanPatch) => void
  /** Read live values at apply time — avoids clobbering what the supplier just typed. */
  getLiveValues: () => { description: string; price: string }
}

const SCAN_TIMEOUT_MS = 20_000

/**
 * Auto-fires once a category is confirmed and the description is still untouched: one photo-based
 * scan fills description + category specs + a price suggestion, and flags a likely catalog duplicate.
 * Any failure (timeout, network, low-confidence, disabled) silently leaves the form exactly as a
 * supplier would see it today — this hook never blocks or retries on its own.
 */
export function useSupplierSmartScan({
  categoryId,
  categoryPathLabel,
  name,
  description,
  images,
  categoryAttrs,
  onApply,
  getLiveValues,
}: Args) {
  const [status, setStatus] = useState<SmartScanStatus>("idle")
  const [duplicate, setDuplicate] = useState(false)
  const lastRunRef = useRef<string | null>(null)

  // Always-latest refs: the in-flight scan reads these at apply time, not at trigger time, so a
  // supplier who starts typing while the scan runs never gets overwritten, and a parent re-render
  // never hands the async callback a stale onApply closure.
  const onApplyRef = useRef(onApply)
  onApplyRef.current = onApply
  const getLiveValuesRef = useRef(getLiveValues)
  getLiveValuesRef.current = getLiveValues

  const reset = useCallback(() => {
    lastRunRef.current = null
    setStatus("idle")
    setDuplicate(false)
  }, [])

  useEffect(() => {
    if (
      !shouldTriggerSmartScan({
        categoryId,
        description,
        images,
        lastRunFingerprint: lastRunRef.current,
      })
    ) {
      return
    }

    const fingerprint = smartScanFingerprint(categoryId, images)
    const previousLastRun = lastRunRef.current
    lastRunRef.current = fingerprint
    setStatus("scanning")

    const ac = new AbortController()
    // True once the request genuinely finished (any outcome) — as opposed to being aborted by this
    // effect's own cleanup, which happens on every dependency change AND, in development, once extra
    // per mount (React Strict Mode). Without this, that harmless double-invoke would mark the scan as
    // "already run" before it ever really ran, and the real attempt would silently never fire.
    let settled = false
    const timeout = setTimeout(() => ac.abort(), SCAN_TIMEOUT_MS)

    const characteristics = categoryAttrs.map((c) => ({
      key: c.key,
      label: c.label,
      type: c.type,
      options: c.options ?? [],
      required: c.required,
    }))

    void (async () => {
      try {
        const res = await fetch("/api/supplier/ai-product-draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          signal: ac.signal,
          body: JSON.stringify(
            buildSmartScanRequestBody({ name, description, images, categoryPathLabel, characteristics })
          ),
        })
        settled = true
        if (!res.ok) {
          setStatus("skipped")
          return
        }
        const json: unknown = await res.json().catch(() => null)
        const result = parseSmartScanResponse(json)
        if (!result) {
          setStatus("skipped")
          return
        }
        const patch = buildSmartScanPatch(result, getLiveValuesRef.current())
        onApplyRef.current(patch)
        setDuplicate(result.duplicate)
        setStatus("done")
      } catch {
        // Aborted (cleanup or timeout), offline, or any transport error — the manual form already
        // works with no scan at all, so there is nothing to roll back on the form itself.
        settled = true
        setStatus("skipped")
      } finally {
        clearTimeout(timeout)
      }
    })()

    return () => {
      clearTimeout(timeout)
      ac.abort()
      if (!settled) lastRunRef.current = previousLastRun
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires on categoryId/images change only; other fields are read fresh via refs/closures at call time.
  }, [categoryId, images])

  return { status, duplicate, reset }
}
