import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  extensionForSupplierFile,
  normalizeSupplierMediaFilename,
  SUPPLIER_MEDIA_STORAGE_UNAVAILABLE,
  uploadSupplierMediaBuffer,
} from "@/lib/supplier-media-storage.server"
import { isApparelProduct } from "@/lib/try-on/is-apparel-product"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Upload transparent PNG flat-lay for virtual try-on (supplier-owned product). */
export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id || (session.user as { role?: string }).role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await context.params
  const product = await prisma.product.findFirst({
    where: { id, supplierId: session.user.id },
    select: {
      categories: true,
      category: { select: { fullPath: true } },
    },
  })
  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (
    !isApparelProduct({
      categoryFullPath: product.category?.fullPath,
      legacyCategories: product.categories,
    })
  ) {
    return NextResponse.json(
      { error: "Try-on garment upload is only for apparel products" },
      { status: 400 }
    )
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }

  const file = form.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Missing PNG file" }, { status: 400 })
  }

  if (!file.type.includes("png") && !file.name.toLowerCase().endsWith(".png")) {
    return NextResponse.json({ error: "Garment must be a PNG with transparent background" }, { status: 400 })
  }

  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "PNG must be under 8 MB" }, { status: 400 })
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer())
    const ext = extensionForSupplierFile(file, "image")
    const { url } = await uploadSupplierMediaBuffer({
      userId: session.user.id,
      bytes,
      contentType: "image/png",
      ext,
      kind: "image",
      filenameBase: normalizeSupplierMediaFilename(file.name || "tryon-garment"),
      subfolder: "try-on-garments",
    })

    console.log("[try-on]", { result: "garment_uploaded", productId: id, url })

    return NextResponse.json({ tryOnGarmentUrl: url })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes(SUPPLIER_MEDIA_STORAGE_UNAVAILABLE)) {
      return NextResponse.json({ error: message }, { status: 503 })
    }
    console.error("[try-on]", { result: "garment_upload_failed", productId: id, message })
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
