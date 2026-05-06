import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { NextRequest, NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const maxBytes = 12 * 1024 * 1024 // 12 MB

function getS3Client(): S3Client | null {
  const region = process.env.AWS_REGION?.trim()
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim()
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim()
  if (!region || !accessKeyId || !secretAccessKey) return null
  return new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  })
}

function publicObjectUrl(bucket: string, region: string, key: string): string {
  const enc = encodeURIComponent(key).replace(/%2F/g, "/")
  return `https://${bucket}.s3.${region}.amazonaws.com/${enc}`
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== "SUPPLIER") {
    return NextResponse.json({ error: "Supplier session required" }, { status: 401 })
  }

  const bucket = process.env.AWS_BUCKET_NAME?.trim()
  const region = process.env.AWS_REGION?.trim()
  const client = getS3Client()
  if (!client || !bucket || !region) {
    return NextResponse.json(
      { error: "S3 is not configured (AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_BUCKET_NAME)" },
      { status: 503 }
    )
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }

  const file = formData.get("image")
  const title = String(formData.get("title") ?? "").trim()
  const priceRaw = formData.get("price")
  const categoryId = String(formData.get("categoryId") ?? "").trim()
  const stockRaw = formData.get("stock")

  const price = typeof priceRaw === "string" ? parseFloat(priceRaw) : Number(priceRaw)
  const stock = stockRaw != null && stockRaw !== "" ? parseInt(String(stockRaw), 10) : 0

  if (!(file instanceof File) || !title || !Number.isFinite(price) || !categoryId) {
    return NextResponse.json({ error: "Missing fields (image, title, price, categoryId)" }, { status: 400 })
  }

  if (!file.size || file.size > maxBytes) {
    return NextResponse.json({ error: "Image must be under 12MB" }, { status: 400 })
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "File must be an image" }, { status: 400 })
  }

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { parent: { select: { name: true } } },
  })
  if (!category) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 })
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "image"
  const key = `products/${Date.now()}-${safeName}`

  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: file.type || "application/octet-stream",
      })
    )
  } catch (e) {
    console.error("[upload] S3 PutObject", e)
    return NextResponse.json({ error: "Upload to storage failed" }, { status: 502 })
  }

  const imageUrl = publicObjectUrl(bucket, region, key)

  const categoriesLabels = [category.parent?.name, category.name].filter(
    (n): n is string => typeof n === "string" && n.length > 0
  )

  const product = await prisma.product.create({
    data: {
      supplierId: session.user.id,
      name: title,
      description: `Added via supplier upload.`,
      images: [imageUrl],
      categories: categoriesLabels.length ? categoriesLabels : [category.name],
      basePriceCents: Math.max(0, Math.round(price * 100)),
      commissionRate: 15,
      stock: Number.isFinite(stock) ? Math.max(0, stock) : 0,
      active: true,
      categoryId: category.id,
      variants: { source: "supplier-upload" },
      shippingType: "standard",
      handlingDays: 1,
    },
  })

  return NextResponse.json({
    product: {
      id: product.id,
      name: product.name,
      basePriceCents: product.basePriceCents,
      images: product.images,
      categoryId: product.categoryId,
      stock: product.stock,
    },
  })
}
