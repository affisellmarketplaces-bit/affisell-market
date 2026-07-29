"use client"

import dynamic from "next/dynamic"
import { usePathname, useSearchParams } from "next/navigation"
import { Suspense, useCallback, useEffect, useState } from "react"

import { useIdleMount } from "@/hooks/use-idle-mount"
import { useMirrorAttractIdle } from "@/hooks/use-mirror-attract-idle"
import {
  isMirrorAttractRouteAllowed,
  readMirrorAttractDelayMs,
  readMirrorAttractEnabled,
  readMirrorAttractForceKiosk,
  type MirrorShowcaseProduct,
} from "@/lib/mirror-showcase-shared"

const MirrorShowcaseOverlay = dynamic(
  () =>
    import("@/components/attract/mirror-showcase-overlay").then((m) => ({
      default: m.MirrorShowcaseOverlay,
    })),
  { ssr: false }
)

function MirrorAttractActive() {
  const pathname = usePathname() ?? "/"
  const searchParams = useSearchParams()
  const forceKiosk = readMirrorAttractForceKiosk(searchParams)
  const enabled =
    readMirrorAttractEnabled(searchParams) && isMirrorAttractRouteAllowed(pathname)
  const delayMs = readMirrorAttractDelayMs(forceKiosk)

  const { visible, dismiss } = useMirrorAttractIdle({ enabled, delayMs, forceKiosk })
  const [products, setProducts] = useState<MirrorShowcaseProduct[]>([])
  const [loaded, setLoaded] = useState(false)

  const prefetch = useCallback(async () => {
    if (loaded) return
    try {
      const res = await fetch("/api/mirror-showcase", { credentials: "same-origin" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as { products?: MirrorShowcaseProduct[] }
      setProducts(Array.isArray(json.products) ? json.products : [])
      console.log("[mirror-attract]", {
        event: "prefetch",
        count: json.products?.length ?? 0,
      })
    } catch (err) {
      console.log("[mirror-attract]", {
        event: "prefetch_error",
        error: err instanceof Error ? err.message : "unknown",
      })
      setProducts([])
    } finally {
      setLoaded(true)
    }
  }, [loaded])

  useEffect(() => {
    if (!enabled) return
    void prefetch()
  }, [enabled, prefetch])

  if (!enabled || !visible || !loaded || products.length === 0) return null

  return <MirrorShowcaseOverlay products={products} onDismiss={dismiss} />
}

/** Mirror vitrine — idle overlay with floating products. Flag: NEXT_PUBLIC_MIRROR_ATTRACT=1 or ?attract=1 */
export function MirrorAttractDeferred() {
  const idleReady = useIdleMount({ idleTimeoutMs: 3200, fallbackDelayMs: 900 })
  if (!idleReady) return null

  return (
    <Suspense fallback={null}>
      <MirrorAttractActive />
    </Suspense>
  )
}
