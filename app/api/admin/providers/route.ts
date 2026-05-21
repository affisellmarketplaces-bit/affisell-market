import type { Prisma } from "@prisma/client"
import { type NextRequest, NextResponse } from "next/server"

import { mergeHealthMetadata } from "@/lib/admin/providers/metadata"
import { providerFormSchema } from "@/lib/admin/providers/schemas"
import { sealProviderCredentials } from "@/lib/admin/providers/seal"
import { uniqueProviderSlug } from "@/lib/admin/providers/slug"
import { toProviderListRow } from "@/lib/admin/providers/serialize"
import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function buildApiConfig(apiEndpoint?: string) {
  const endpoint = apiEndpoint?.trim()
  if (!endpoint) return {}
  return { apiEndpoint: endpoint }
}

export async function GET() {
  const gate = await requireAdminSession()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const rows = await prisma.fulfillmentProvider.findMany({
    orderBy: { updatedAt: "desc" },
  })

  return NextResponse.json({ rows: rows.map(toProviderListRow) })
}

export async function POST(req: NextRequest) {
  const gate = await requireAdminSession()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const parsed = providerFormSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", details: parsed.error.flatten() }, { status: 400 })
  }

  const { name, type, apiEndpoint, paymentMethod, credentials } = parsed.data
  const slug = await uniqueProviderSlug(name, async (s) =>
    Boolean(await prisma.fulfillmentProvider.findUnique({ where: { slug: s }, select: { id: true } }))
  )

  let credentialsEncrypted: string | null = null
  try {
    credentialsEncrypted = credentials ? sealProviderCredentials(credentials) : null
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "seal_failed", message: msg }, { status: 500 })
  }

  const created = await prisma.fulfillmentProvider.create({
    data: {
      name,
      slug,
      channelType: type,
      paymentMethod,
      apiConfig: buildApiConfig(apiEndpoint) as Prisma.InputJsonValue,
      credentialsEncrypted,
      metadata: mergeHealthMetadata(null, {
        healthStatus: "OK",
        lastHealthCheckAt: new Date().toISOString(),
        healthMessage: "Created",
      }) as Prisma.InputJsonValue,
    },
  })

  return NextResponse.json({ row: toProviderListRow(created) }, { status: 201 })
}
