import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { hasGeminiApiKey } from "@/lib/ai/gemini-client"
import { optimizeSupplierSpecField } from "@/lib/supplier-optimize-spec-field"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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

  const fieldKey = typeof body.fieldKey === "string" ? body.fieldKey.trim() : ""
  const fieldLabel = typeof body.fieldLabel === "string" ? body.fieldLabel.trim() : fieldKey
  const currentValue = typeof body.currentValue === "string" ? body.currentValue : ""
  const title = typeof body.title === "string" ? body.title : ""
  const description = typeof body.description === "string" ? body.description : ""
  const categoryPath = typeof body.categoryPath === "string" ? body.categoryPath : ""
  const bullets = Array.isArray(body.bullets)
    ? body.bullets.filter((x): x is string => typeof x === "string")
    : []

  if (!fieldKey) {
    return NextResponse.json({ error: "fieldKey requis" }, { status: 400 })
  }

  if (title.trim().length < 2 && description.trim().length < 8 && bullets.length === 0) {
    return NextResponse.json(
      { error: "Ajoutez un titre ou une description pour guider l'optimisation." },
      { status: 400 }
    )
  }

  try {
    const text = await optimizeSupplierSpecField({
      fieldKey,
      fieldLabel,
      currentValue,
      title,
      description,
      categoryPath,
      bullets,
    })
    return NextResponse.json({ text })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Optimisation impossible"
    console.error("[supplier-optimize-spec-field]", { fieldKey, message })
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
