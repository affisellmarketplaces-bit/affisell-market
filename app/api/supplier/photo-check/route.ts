import { auth } from "@/auth"
import { hasAnthropicApiKey } from "@/lib/ai/anthropic-client"
import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { assessGallery, originalResolutionCandidate, type PhotoIssue, type PhotoMetrics } from "@/lib/photo-quality"
import { measurePhoto } from "@/lib/photo-quality.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

const MAX_IMAGES = 8
const CONCURRENCY = 3

type ImageReport = {
  url: string
  ok: boolean
  metrics: Pick<PhotoMetrics, "width" | "height" | "bytes" | "format"> | null
  issues: PhotoIssue[]
  /** Original-resolution URL, only when it loads and is clearly bigger than the current one. */
  betterUrl: string | null
}

async function inBatches<T, R>(items: readonly T[], size: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i]!, i)
      }
    })
  )
  return out
}

/**
 * POST { images: string[] } — measured quality of a supplier's product photos (resolution, ratio, compression,
 * background of the main shot, near-duplicates). Advisory: never blocks publishing.
 */
export async function POST(req: Request) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return Response.json({ error: "Not authenticated" }, { status: 401 })
  if ((session.user as { role?: string }).role !== "SUPPLIER") return Response.json({ error: "Forbidden" }, { status: 403 })

  const limited = await rateLimitResponseAsync(rateLimitClientKey(req, userId), { limit: 20, windowMs: 5 * 60_000, prefix: "supplier-photo-check" })
  if (limited) return limited

  let body: { images?: unknown }
  try {
    body = (await req.json()) as { images?: unknown }
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const refs = (Array.isArray(body.images) ? body.images : [])
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0 && x.length <= 2048)
    .slice(0, MAX_IMAGES)
  if (refs.length === 0) return Response.json({ error: "images required" }, { status: 400 })

  const measured = await inBatches(refs, CONCURRENCY, async (url) => ({ url, result: await measurePhoto(url) }))
  const metrics = measured.map((m) => (m.result.ok ? m.result.metrics : null))
  const gallery = assessGallery(metrics)

  const images: ImageReport[] = await inBatches(measured, CONCURRENCY, async (m, i) => {
    const mt = metrics[i] ?? null
    let betterUrl: string | null = null
    const candidate = originalResolutionCandidate(m.url)
    if (candidate && mt) {
      const better = await measurePhoto(candidate)
      if (better.ok && Math.min(better.metrics.width, better.metrics.height) >= Math.min(mt.width, mt.height) * 1.25) betterUrl = candidate
    }
    return {
      url: m.url,
      ok: m.result.ok,
      metrics: mt ? { width: mt.width, height: mt.height, bytes: mt.bytes, format: mt.format } : null,
      issues: gallery.perImage[i]?.issues ?? [],
      betterUrl,
    }
  })

  return Response.json(
    { images, gallery: { issues: gallery.galleryIssues, score: gallery.score }, ai: { available: hasAnthropicApiKey() } },
    { headers: { "Cache-Control": "private, no-store" } }
  )
}
