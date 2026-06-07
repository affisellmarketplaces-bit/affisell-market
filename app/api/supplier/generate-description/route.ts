import { auth } from "@/auth"
import {
  extractProductSpecsFromNotes,
  generateSupplierProductDescription,
  type GenerateDescriptionRequest,
} from "@/lib/supplier-generate-description"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!process.env.GROQ_API_KEY?.trim()) {
    return Response.json(
      { error: "IA indisponible (GROQ_API_KEY manquante)." },
      { status: 503 }
    )
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return Response.json({ error: "JSON invalide" }, { status: 400 })
  }

  const title = typeof body.title === "string" ? body.title : ""
  const notes = typeof body.notes === "string" ? body.notes : typeof body.description === "string" ? body.description : ""
  const categoryPath = typeof body.categoryPath === "string" ? body.categoryPath : ""

  const productSpecs = Array.isArray(body.productSpecs)
    ? body.productSpecs
        .filter((row): row is { label: string; value: string } => {
          if (!row || typeof row !== "object") return false
          const o = row as Record<string, unknown>
          return typeof o.label === "string" && typeof o.value === "string"
        })
        .map((row) => ({ label: row.label.trim(), value: row.value.trim() }))
        .filter((row) => row.label.length > 0 && row.value.length > 0)
        .slice(0, 24)
    : []

  const bullets = Array.isArray(body.bullets)
    ? body.bullets.filter((x): x is string => typeof x === "string")
    : Array.isArray(body.bulletPoints)
      ? body.bulletPoints.filter((x): x is string => typeof x === "string")
      : []

  const productImageUrls = Array.isArray(body.productImageUrls)
    ? body.productImageUrls.filter((x): x is string => typeof x === "string")
    : []

  const productImageDataUrls = Array.isArray(body.productImageDataUrls)
    ? body.productImageDataUrls.filter((x): x is string => typeof x === "string")
    : []

  const illustrationDataUrls = Array.isArray(body.illustrationDataUrls)
    ? body.illustrationDataUrls.filter((x): x is string => typeof x === "string")
    : []

  const generateMissingIllustrations = body.generateMissingIllustrations !== false

  const specsFromNotes = extractProductSpecsFromNotes(notes)
  const mergedSpecCount = new Set([
    ...productSpecs.map((s) => s.label.toLowerCase()),
    ...specsFromNotes.map((s) => s.label.toLowerCase()),
  ]).size

  if (
    title.trim().length < 2 &&
    notes.trim().length < 10 &&
    bullets.length === 0 &&
    mergedSpecCount === 0 &&
    productImageUrls.length === 0 &&
    productImageDataUrls.length === 0 &&
    illustrationDataUrls.length === 0
  ) {
    return Response.json(
      {
        error:
          "Ajoutez un titre, des notes dans la description, des points clés ou au moins une photo produit.",
      },
      { status: 400 }
    )
  }

  const input: GenerateDescriptionRequest = {
    title,
    notes,
    bullets,
    categoryPath,
    productSpecs,
    productImageUrls,
    productImageDataUrls,
    illustrationDataUrls,
    generateMissingIllustrations,
  }

  try {
    const result = await generateSupplierProductDescription(input)
    return Response.json(result)
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Génération impossible" },
      { status: 502 }
    )
  }
}
