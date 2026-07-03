import { NextResponse } from "next/server"

import { guardSupplierAiRoute } from "@/lib/ai-route-guards"
import { hasGeminiApiKey } from "@/lib/ai/gemini-client"
import {
  generateSupplierVariantsFromPrompt,
  type GenerateVariantsCharDef,
} from "@/lib/supplier-generate-variants"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function parseCharacteristics(raw: unknown): GenerateVariantsCharDef[] {
  if (!Array.isArray(raw)) return []
  const out: GenerateVariantsCharDef[] = []
  for (const row of raw) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue
    const o = row as Record<string, unknown>
    const key = typeof o.key === "string" ? o.key.trim() : ""
    if (!key) continue
    out.push({
      key: key.slice(0, 80),
      label: typeof o.label === "string" ? o.label.trim().slice(0, 120) : key,
      type: typeof o.type === "string" ? o.type.trim().toUpperCase() : "TEXT",
      options: Array.isArray(o.options)
        ? o.options.filter((x): x is string => typeof x === "string").map((x) => x.trim().slice(0, 200))
        : [],
      required: o.required === true,
    })
  }
  return out
}

export async function POST(req: Request) {
  const gate = await guardSupplierAiRoute(req, "supplier-generate-variants")
  if (!gate.ok) return gate.response

  if (!hasGeminiApiKey() && !process.env.GROQ_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "IA indisponible (GEMINI_API_KEY ou GROQ_API_KEY manquante)." },
      { status: 503 }
    )
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : ""
  if (prompt.length < 8) {
    return NextResponse.json(
      { error: "Décrivez votre demande (couleurs, tailles, caractéristiques…) — min. 8 caractères." },
      { status: 400 }
    )
  }

  const basePriceRaw = Number(body.basePriceEur)
  const commissionRaw = Number(body.defaultCommission)

  try {
    const result = await generateSupplierVariantsFromPrompt({
      prompt,
      title: typeof body.title === "string" ? body.title : "",
      description: typeof body.description === "string" ? body.description : "",
      categoryPath: typeof body.categoryPath === "string" ? body.categoryPath : "",
      bullets: Array.isArray(body.bullets)
        ? body.bullets.filter((x): x is string => typeof x === "string")
        : [],
      basePriceEur: Number.isFinite(basePriceRaw) && basePriceRaw > 0 ? basePriceRaw : 10,
      defaultCommission:
        Number.isFinite(commissionRaw) && commissionRaw >= 0 ? Math.min(100, commissionRaw) : 15,
      skuPrefix: typeof body.skuPrefix === "string" ? body.skuPrefix : "PRD",
      characteristics: parseCharacteristics(body.characteristics),
    })

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Génération impossible"
    console.error("[supplier-generate-variants]", { message, userId: gate.userId })
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
