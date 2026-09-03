import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import type { DropForgeCompletePreview } from "@/lib/dropforge-complete-import"
import { auditDropForgePreview, type DropForgeRefineQuickAction } from "@/lib/dropforge-refine-audit"
import { refineDropForgePreview } from "@/lib/dropforge-refine.server"
import { resellerImportPreviewJson } from "@/lib/supplier-dropforge-import.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const QUICK_ACTIONS = new Set<DropForgeRefineQuickAction>([
  "images",
  "description",
  "variants",
  "specs",
  "category",
  "brand",
  "title",
  "cost",
])

function isPreview(v: unknown): v is DropForgeCompletePreview {
  if (!v || typeof v !== "object") return false
  const o = v as Record<string, unknown>
  return typeof o.sourceUrl === "string" && typeof o.title === "string"
}

/**
 * POST /api/dropforge/refine
 * Patch existing preview from natural language — no full re-import.
 */
export async function POST(req: Request) {
  try {
    const session = await auth()
    const userId = session?.user?.id ?? null
    const limited = await rateLimitResponseAsync(rateLimitClientKey(req, userId), {
      limit: userId ? 80 : 40,
      windowMs: 60 * 60 * 1000,
      prefix: "dropforge-refine",
    })
    if (limited) return limited

    const body = (await req.json().catch(() => ({}))) as {
      preview?: unknown
      instruction?: string
      quickAction?: string
      locale?: string
    }

    if (!isPreview(body.preview)) {
      return NextResponse.json({ error: "preview_required" }, { status: 400 })
    }

    const quickAction =
      typeof body.quickAction === "string" &&
      QUICK_ACTIONS.has(body.quickAction as DropForgeRefineQuickAction)
        ? (body.quickAction as DropForgeRefineQuickAction)
        : undefined

    const locale = body.locale === "en" ? "en" : "fr"

    if (body.instruction === "__audit__") {
      const gaps = auditDropForgePreview(body.preview)
      return NextResponse.json({ ok: true, gaps, preview: body.preview })
    }

    const refined = await refineDropForgePreview({
      preview: body.preview,
      instruction: typeof body.instruction === "string" ? body.instruction : "",
      quickAction,
      locale,
    })

    if (!refined.ok) {
      return NextResponse.json({ error: refined.error }, { status: refined.status })
    }

    const { result } = refined
    return NextResponse.json({
      ok: true,
      preview: resellerImportPreviewJson(result.preview),
      message: result.message,
      applied: result.applied,
      gaps: result.gaps,
      warnings: result.warnings,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[dropforge-refine]", { result: "fail", error: msg.slice(0, 200) })
    return NextResponse.json(
      { error: "Co-Pilot indisponible — réessayez dans quelques secondes." },
      { status: 500 }
    )
  }
}
