import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { generateSupplierProductTitle } from "@/lib/supplier-generate-title"

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

  if (!process.env.GROQ_API_KEY?.trim()) {
    return NextResponse.json({ error: "IA indisponible (GROQ_API_KEY manquante)." }, { status: 503 })
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
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
