import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { hasGeminiApiKey } from "@/lib/ai/gemini-client"
import {
  optimizeSupplierVariants,
  type OptimizeVariantsInput,
  type OptimizeVariantsRowInput,
} from "@/lib/supplier-optimize-variants"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function parseRows(raw: unknown): OptimizeVariantsRowInput[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((row) => {
      if (!row || typeof row !== "object") return null
      const o = row as Record<string, unknown>
      const index = typeof o.index === "number" ? Math.floor(o.index) : -1
      if (index < 0) return null
      return {
        index,
        color: typeof o.color === "string" ? o.color : "",
        size: typeof o.size === "string" ? o.size : o.size === null ? null : null,
        sku: typeof o.sku === "string" ? o.sku : o.sku === null ? null : null,
      }
    })
    .filter((row): row is OptimizeVariantsRowInput => row !== null)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!hasGeminiApiKey() && !process.env.GROQ_API_KEY?.trim()) {
    return NextResponse.json({ error: "IA indisponible (GEMINI_API_KEY ou GROQ_API_KEY manquante)." }, { status: 503 })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  const mode = body.mode === "advanced" ? "advanced" : body.mode === "simple" ? "simple" : null
  if (!mode) {
    return NextResponse.json({ error: "mode requis (simple | advanced)" }, { status: 400 })
  }

  const title = typeof body.title === "string" ? body.title : ""
  const description = typeof body.description === "string" ? body.description : ""
  const categoryPath = typeof body.categoryPath === "string" ? body.categoryPath : ""
  const bullets = Array.isArray(body.bullets)
    ? body.bullets.filter((x): x is string => typeof x === "string")
    : []

  if (title.trim().length < 2 && description.trim().length < 8 && bullets.length === 0) {
    return NextResponse.json(
      { error: "Ajoutez un titre ou une description pour guider l'optimisation." },
      { status: 400 }
    )
  }

  const input: OptimizeVariantsInput = {
    mode,
    title,
    description,
    categoryPath,
    bullets,
    sizesText: typeof body.sizesText === "string" ? body.sizesText : undefined,
    skuPrefix: typeof body.skuPrefix === "string" ? body.skuPrefix : "PRD",
    rows: mode === "advanced" ? parseRows(body.rows) : undefined,
    simpleColors:
      mode === "simple" && Array.isArray(body.simpleColors)
        ? body.simpleColors
            .map((row) => {
              if (!row || typeof row !== "object") return null
              const o = row as Record<string, unknown>
              const index = typeof o.index === "number" ? Math.floor(o.index) : -1
              if (index < 0) return null
              return { index, name: typeof o.name === "string" ? o.name : "" }
            })
            .filter((row): row is { index: number; name: string } => row !== null)
        : undefined,
  }

  if (mode === "advanced" && (!input.rows || input.rows.length === 0)) {
    return NextResponse.json({ error: "Ajoutez au moins une ligne variante." }, { status: 400 })
  }
  if (mode === "simple" && (!input.simpleColors || input.simpleColors.length === 0)) {
    return NextResponse.json({ error: "Ajoutez au moins une couleur." }, { status: 400 })
  }

  try {
    const result = await optimizeSupplierVariants(input)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Optimisation impossible"
    console.error("[supplier-optimize-variants]", { mode, message })
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
