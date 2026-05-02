import path from "node:path"

import { mkdir, writeFile } from "fs/promises"

import { auth } from "@/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_BYTES = 2 * 1024 * 1024
const MIME_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (session.user.role !== "AFFILIATE") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const ct = req.headers.get("content-type") ?? ""
  if (!ct.includes("multipart/form-data")) {
    return Response.json({ error: "Use multipart" }, { status: 415 })
  }

  const fd = await req.formData()
  const file = fd.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "Missing file" }, { status: 400 })
  }
  if (!MIME_EXT[file.type]) {
    return Response.json({ error: "Only PNG/JPEG allowed" }, { status: 400 })
  }
  if (file.size > MAX_BYTES) return Response.json({ error: "File too large" }, { status: 400 })

  const buf = Buffer.from(await file.arrayBuffer())
  const ext = MIME_EXT[file.type]
  const filename = `affiliate-${session.user.id}-${Date.now()}${ext}`
  const dir = path.join(process.cwd(), "public", "uploads")
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, filename), buf)

  return Response.json({ url: `/uploads/${filename}` })
}
