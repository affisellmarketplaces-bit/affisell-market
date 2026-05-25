import path from "node:path"

import { mkdir, writeFile } from "fs/promises"

import { auth } from "@/auth"
import { allocateUniqueSlug, ensureMerchantStore } from "@/lib/ensure-store"
import { prisma } from "@/lib/prisma"
import { themeFromFormFields } from "@/lib/storefront-theme-shared"
import { normalizeCustomDomain } from "@/lib/verify-store-domain"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_LOGO_BYTES = 2 * 1024 * 1024
const MIME_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
}

function safeHttpsUrl(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined
  const u = raw.trim()
  if (!u) return ""
  try {
    const parsed = new URL(u)
    if (parsed.protocol !== "https:") return ""
    return u.slice(0, 2000)
  } catch {
    return ""
  }
}

export async function POST(req: Request) {
  const session = await auth()
  const userId = session?.user?.id
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!userId) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if (role !== "SUPPLIER" && role !== "AFFILIATE") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const ct = req.headers.get("content-type") ?? ""
  if (!ct.includes("multipart/form-data")) {
    return Response.json({ error: "Use multipart/form-data" }, { status: 415 })
  }

  let store = await prisma.store.findUnique({ where: { userId } })
  if (!store) {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } })
    if (!u) return Response.json({ error: "Not found" }, { status: 404 })
    store = await ensureMerchantStore({ userId, email: u.email, displayName: u.name })
  }

  const fd = await req.formData()
  const nameIn = fd.get("name")
  const name = typeof nameIn === "string" ? nameIn.trim().slice(0, 40) : ""
  if (!name) {
    return Response.json({ error: "Store name is required" }, { status: 400 })
  }

  const descriptionIn = fd.get("description")
  let description: string | null = store.description
  if (typeof descriptionIn === "string") {
    description = descriptionIn.trim().slice(0, 600) || null
  }

  const logoUrlText = fd.get("logoUrl")
  const bannerRaw = fd.get("bannerUrl")

  const customDomRaw = fd.get("customDomain")
  const customDomainNormalized =
    customDomRaw === null || customDomRaw === undefined
      ? undefined
      : normalizeCustomDomain(typeof customDomRaw === "string" ? customDomRaw : "")

  const themePrimary = fd.get("themePrimary")
  const themeAccent = fd.get("themeAccent")
  const hasThemeFields = themePrimary !== null || themeAccent !== null
  const storefrontTheme = hasThemeFields
    ? themeFromFormFields(themePrimary, themeAccent)
    : undefined

  const logoFile = fd.get("logo")
  let logoUrl: string | null = store.logoUrl

  if (logoFile instanceof File && logoFile.size > 0) {
    if (!MIME_EXT[logoFile.type]) {
      return Response.json({ error: "Logo must be PNG or JPEG" }, { status: 400 })
    }
    if (logoFile.size > MAX_LOGO_BYTES) {
      return Response.json({ error: "Logo file is too large (max ~2 MB)" }, { status: 400 })
    }
    const buf = Buffer.from(await logoFile.arrayBuffer())
    const ext = MIME_EXT[logoFile.type]
    const filename = `${userId}-${Date.now()}${ext}`
    const dir = path.join(process.cwd(), "public", "uploads")
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, filename), buf)
    logoUrl = `/uploads/${filename}`
  } else {
    const u = safeHttpsUrl(logoUrlText)
    if (u !== undefined) {
      logoUrl = u === "" ? null : u
    }
  }

  let bannerUrl: string | null = store.bannerUrl
  if (typeof bannerRaw === "string") {
    const t = bannerRaw.trim()
    if (!t) {
      bannerUrl = null
    } else {
      try {
        const u = new URL(t)
        if (u.protocol === "https:") bannerUrl = t.slice(0, 2000)
      } catch {
        /* ignore invalid */
      }
    }
  }

  const slug = await allocateUniqueSlug(name, store.userId)
  const prevDom = store.customDomain ?? null
  let customDomain = store.customDomain
  let domainVerified = store.domainVerified
  if (customDomainNormalized !== undefined) {
    customDomain = customDomainNormalized
    if ((prevDom ?? "") !== (customDomain ?? "")) {
      domainVerified = false
    }
  }

  try {
    const updated = await prisma.store.update({
      where: { id: store.id },
      data: {
        name,
        slug,
        logoUrl,
        bannerUrl,
        description,
        customDomain,
        domainVerified,
        ...(storefrontTheme !== undefined ? { storefrontTheme } : {}),
      },
    })

    return Response.json({ ok: true, store: updated })
  } catch (e: unknown) {
    const code = typeof e === "object" && e && "code" in e ? (e as { code: string }).code : ""
    if (code === "P2002") {
      return Response.json({ error: "Custom domain or slug conflict — choose another domain" }, { status: 409 })
    }
    throw e
  }
}
