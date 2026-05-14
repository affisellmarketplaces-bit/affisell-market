import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import OpenAI from "openai"
import type { ChatCompletionContentPart, ChatCompletionMessageParam } from "openai/resources/chat/completions"

import { auth } from "@/auth"
import { ensureMerchantStore } from "@/lib/ensure-store"
import { fileToDataUrl, loadImageAsDataUrlForOpenAI } from "@/lib/ai/load-store-image-for-vision"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_PHOTO_BYTES = 4 * 1024 * 1024
const MIME_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
}

async function visionToDallePrompt(openai: OpenAI, dataUrl: string, storeName: string, mode: "from-logo" | "from-photo") {
  const modeHint =
    mode === "from-logo"
      ? "The image is a brand logo or mark. Derive palette, shapes, and mood for a friendly illustrated store mascot or abstract avatar — not a copy of the logo as-is."
      : "The image is a person reference. Produce a stylized illustrated portrait suitable for a shop profile — not a photorealistic duplicate, no attempt to match biometric identity."

  const system =
    "You write a single English paragraph to use as a DALL-E 3 prompt (max 700 characters). " +
    "Subject: one square 1:1 professional marketplace store profile avatar, digital illustration, soft lighting, centered. " +
    "Rules: no readable text, no logos, no watermarks, no trademarked characters, no celebrity names. " +
    "Neutral smooth gradient background. Output ONLY the prompt paragraph, no quotes or labels."

  const userContent: ChatCompletionContentPart[] = [
    { type: "text", text: `Store name (context only, do not render as text in image): ${storeName.slice(0, 80)}.` },
    { type: "text", text: modeHint },
    { type: "image_url", image_url: { url: dataUrl } },
  ]

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    { role: "user", content: userContent },
  ]

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    temperature: 0.7,
    max_tokens: 500,
  })

  const raw = completion.choices[0]?.message?.content?.trim() ?? ""
  const cleaned = raw.replace(/^["']|["']$/g, "").slice(0, 3200)
  if (!cleaned) throw new Error("Empty prompt from vision step")
  return `${cleaned} Square 1:1 composition, high quality illustration, ecommerce profile avatar.`
}

export async function POST(req: Request) {
  const key = process.env.OPENAI_API_KEY
  if (!key) {
    return Response.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 })
  }

  const session = await auth()
  const userId = session?.user?.id
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!userId) return Response.json({ error: "Not authenticated" }, { status: 401 })
  if (role !== "SUPPLIER" && role !== "AFFILIATE") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  let store = await prisma.store.findUnique({ where: { userId } })
  if (!store) {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } })
    if (!u) return Response.json({ error: "Not found" }, { status: 404 })
    store = await ensureMerchantStore({ userId, email: u.email, displayName: u.name })
  }

  const ct = req.headers.get("content-type") ?? ""

  if (ct.includes("application/json")) {
    const body = (await req.json()) as { clear?: boolean }
    if (body?.clear === true) {
      await prisma.store.update({
        where: { id: store.id },
        data: { aiAvatarUrl: null },
      })
      return Response.json({ ok: true, aiAvatarUrl: null })
    }
    return Response.json({ error: "Unknown JSON body — use { \"clear\": true } or multipart for generation" }, { status: 400 })
  }

  if (!ct.includes("multipart/form-data")) {
    return Response.json({ error: "Use multipart/form-data with mode and optional photo" }, { status: 415 })
  }

  const fd = await req.formData()
  const modeRaw = fd.get("mode")
  const mode = modeRaw === "from-photo" ? "from-photo" : modeRaw === "from-logo" ? "from-logo" : ""
  if (mode !== "from-logo" && mode !== "from-photo") {
    return Response.json({ error: "mode must be from-logo or from-photo" }, { status: 400 })
  }

  const openai = new OpenAI({ apiKey: key })
  let imageDataUrl: string

  if (mode === "from-logo") {
    const logo = store.logoUrl?.trim()
    if (!logo) {
      return Response.json({ error: "Add a store logo first (URL or upload), then generate from logo." }, { status: 400 })
    }
    const loaded = await loadImageAsDataUrlForOpenAI(logo)
    if ("error" in loaded) return Response.json({ error: loaded.error }, { status: 400 })
    imageDataUrl = loaded.dataUrl
  } else {
    const file = fd.get("photo")
    if (!(file instanceof File) || file.size <= 0) {
      return Response.json({ error: "Upload a photo (field name: photo)" }, { status: 400 })
    }
    if (!MIME_EXT[file.type]) {
      return Response.json({ error: "Photo must be PNG or JPEG" }, { status: 400 })
    }
    if (file.size > MAX_PHOTO_BYTES) {
      return Response.json({ error: "Photo is too large (max 4 MB)" }, { status: 400 })
    }
    const buf = Buffer.from(await file.arrayBuffer())
    imageDataUrl = fileToDataUrl(buf, file.type)
  }

  try {
    const dallePrompt = await visionToDallePrompt(openai, imageDataUrl, store.name, mode)

    const gen = await openai.images.generate({
      model: "dall-e-3",
      prompt: dallePrompt.slice(0, 4000),
      n: 1,
      size: "1024x1024",
      quality: "standard",
    })

    const first = gen.data?.[0]
    const url = first?.url
    if (!url) {
      return Response.json({ error: "Image API returned no URL" }, { status: 502 })
    }

    const imgRes = await fetch(url)
    if (!imgRes.ok) {
      return Response.json({ error: "Could not download generated image" }, { status: 502 })
    }
    const outBuf = Buffer.from(await imgRes.arrayBuffer())
    const filename = `ai-avatar-${userId}-${Date.now()}.png`
    const dir = path.join(process.cwd(), "public", "uploads")
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, filename), outBuf)

    const aiAvatarUrl = `/uploads/${filename}`
    const updated = await prisma.store.update({
      where: { id: store.id },
      data: { aiAvatarUrl },
    })

    return Response.json({ ok: true, aiAvatarUrl: updated.aiAvatarUrl })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Generation failed"
    if (msg.toLowerCase().includes("safety") || msg.toLowerCase().includes("content_policy")) {
      return Response.json({ error: "Image was blocked by safety policy — try a different photo or logo." }, { status: 422 })
    }
    console.error("[store-avatar]", e)
    return Response.json({ error: msg }, { status: 500 })
  }
}
