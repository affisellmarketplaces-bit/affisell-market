import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { getGroqApiKey } from "@/lib/ai/groq-client"
import { hasOpenAiFallback } from "@/lib/ai/openai-chat-fallback"
import { generateSupplierProductTitle } from "@/lib/supplier-generate-title"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function sanitizeAiError(raw: string): string {
  const t = raw.trim()
  if (!t) return "Génération impossible"
  if (/model_not_found|does not exist|llama-4-scout/i.test(t)) {
    return "Modèle IA indisponible — réessayez dans un instant."
  }
  if (/rate limit|429/i.test(t)) {
    return "IA saturée — réessayez dans quelques secondes."
  }
  // Never surface raw provider JSON to the supplier UI.
  if (t.startsWith("{") || t.includes('"error"') || t.length > 180) {
    return "Optimisation IA indisponible — réessayez."
  }
  return t.slice(0, 160)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!getGroqApiKey() && !hasOpenAiFallback()) {
    return NextResponse.json(
      { error: "IA indisponible (GROQ_API_KEY ou OPENAI_API_KEY manquante)." },
      { status: 503 }
    )
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  const titleDraft = typeof body.title === "string" ? body.title : ""
  const notes =
    typeof body.notes === "string"
      ? body.notes
      : typeof body.description === "string"
        ? body.description
        : ""
  const categoryPath = typeof body.categoryPath === "string" ? body.categoryPath : ""

  const bullets = Array.isArray(body.bullets)
    ? body.bullets.filter((x): x is string => typeof x === "string")
    : []

  const productImageUrls = Array.isArray(body.productImageUrls)
    ? body.productImageUrls.filter((x): x is string => typeof x === "string")
    : []
  const productImageDataUrls = Array.isArray(body.productImageDataUrls)
    ? body.productImageDataUrls.filter((x): x is string => typeof x === "string")
    : []

  if (
    titleDraft.trim().length < 2 &&
    notes.trim().length < 8 &&
    bullets.length === 0 &&
    productImageUrls.length === 0 &&
    productImageDataUrls.length === 0
  ) {
    return NextResponse.json(
      { error: "Ajoutez un brouillon de titre, des notes, des points clés ou des photos." },
      { status: 400 }
    )
  }

  try {
    const result = await generateSupplierProductTitle({
      titleDraft,
      notes,
      bullets,
      categoryPath,
      productImageUrls,
      productImageDataUrls,
    })
    return NextResponse.json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Génération impossible"
    console.error("[generate-title]", { error: msg.slice(0, 400) })
    return NextResponse.json({ error: sanitizeAiError(msg) }, { status: 502 })
  }
}
