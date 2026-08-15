import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  isBrandStudioGenerateField,
  type BrandStudioGenerateField,
} from "@/lib/storefront-brand-field-generate-shared"
import { generateBrandStudioField } from "@/lib/storefront-brand-field-generate.server"
import type { HomepageSectionType } from "@/lib/storefront-sections-shared"
import { HOMEPAGE_SECTION_TYPES } from "@/lib/storefront-sections-shared"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

type RequestBody = {
  field?: BrandStudioGenerateField
  locale?: string
  niche?: string
  sectionType?: HomepageSectionType
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    const role = (session?.user as { role?: string } | undefined)?.role
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    if (role !== "AFFILIATE" && role !== "SUPPLIER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    let body: RequestBody = {}
    try {
      body = (await req.json()) as RequestBody
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    if (!body.field || !isBrandStudioGenerateField(body.field)) {
      return NextResponse.json({ error: "Invalid field" }, { status: 400 })
    }

    if (
      body.sectionType &&
      !(HOMEPAGE_SECTION_TYPES as readonly string[]).includes(body.sectionType)
    ) {
      return NextResponse.json({ error: "Invalid sectionType" }, { status: 400 })
    }

    const result = await generateBrandStudioField({
      userId,
      role,
      field: body.field,
      locale: body.locale,
      niche: body.niche,
      sectionType: body.sectionType,
    })

    console.log("[generate-brand-field]", {
      userId,
      field: body.field,
      result: "ok",
      source: result.source,
    })

    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : "Field generation failed"
    console.log("[generate-brand-field]", { result: "error", error: message })
    const status = message.includes("No order signals") ? 422 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
