import { NextResponse } from "next/server"
import { z } from "zod"

import {
  createSupplierPipelineLeadInNotion,
  notionCategoryForEnterprise,
} from "@/lib/crm/notion-supplier-pipeline"
import {
  ENTERPRISE_CATALOG_SIZES,
  ENTERPRISE_CATEGORIES,
  ENTERPRISE_COMMERCE_STACKS,
  formatEnterpriseLeadNotes,
} from "@/lib/crm/enterprise-lead-shared"
import { rateLimitClientKey, rateLimitResponse } from "@/lib/api-rate-limit"
import { resolveRequestLocale } from "@/lib/resolve-request-locale"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const schema = z
  .object({
    brandName: z.string().trim().min(2).max(120),
    siteUrl: z.union([z.string().trim().url().max(500), z.literal("")]).optional(),
    contactName: z.string().trim().min(2).max(120),
    contactEmail: z.string().trim().email().max(254),
    catalogSize: z.enum(ENTERPRISE_CATALOG_SIZES),
    category: z.enum(ENTERPRISE_CATEGORIES),
    commerceStack: z.enum(ENTERPRISE_COMMERCE_STACKS),
    message: z.string().trim().max(2000).optional(),
    /** Honeypot — must stay empty. */
    website: z.string().max(0).optional(),
    locale: z.string().max(8).optional(),
  })
  .strict()

export async function POST(req: Request) {
  const limited = rateLimitResponse(rateLimitClientKey(req), {
    prefix: "enterprise-apply",
    limit: 4,
    windowMs: 60 * 60 * 1000,
  })
  if (limited) return limited

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_fields" }, { status: 400 })
  }

  if (parsed.data.website && parsed.data.website.length > 0) {
    console.log("[enterprise-apply]", { result: "blocked", reason: "honeypot" })
    return NextResponse.json({ ok: true })
  }

  const locale = await resolveRequestLocale(parsed.data.locale)
  const siteUrl =
    parsed.data.siteUrl && parsed.data.siteUrl.length > 0 ? parsed.data.siteUrl.trim() : null

  const payload = {
    brandName: parsed.data.brandName,
    website: siteUrl,
    contactName: parsed.data.contactName,
    contactEmail: parsed.data.contactEmail,
    catalogSize: parsed.data.catalogSize,
    category: parsed.data.category,
    commerceStack: parsed.data.commerceStack,
    message: parsed.data.message ?? null,
    locale,
  }

  const notes = formatEnterpriseLeadNotes(payload)
  const notion = await createSupplierPipelineLeadInNotion({
    name: payload.brandName,
    siteUrl: payload.website,
    categorie: notionCategoryForEnterprise(payload.category),
    notes,
  })

  console.log("[enterprise-apply]", {
    brandName: payload.brandName,
    contactEmail: payload.contactEmail,
    catalogSize: payload.catalogSize,
    notionOk: notion.ok,
    result: notion.ok ? "queued" : notion.error,
  })

  if (!notion.ok) {
    if (notion.error === "not_configured") {
      return NextResponse.json({ ok: true, queued: true, message: "received_offline" }, { status: 202 })
    }
    return NextResponse.json({ ok: false, error: "crm_unavailable" }, { status: 503 })
  }

  return NextResponse.json({ ok: true, notionUrl: notion.notionUrl })
}
