import { NextRequest, NextResponse } from "next/server"

import {
  renderExpansionBuyerEmailHtml,
  type ExpansionBuyerEmailKind,
} from "@/lib/emails/render-expansion-buyer-email"
import { loadExpansionGraduationPreviewOrder } from "@/lib/admin/load-expansion-graduation-preview-order"
import { requireAdminSession } from "@/lib/admin/require-admin-session"
import { normalizeVisitorCountryIso2 } from "@/lib/visitor-country"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function parseEmailKind(raw: string | null): ExpansionBuyerEmailKind {
  if (raw === "followup" || raw === "graduated") return raw
  return "launch"
}

export async function GET(req: NextRequest) {
  const gate = await requireAdminSession()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  const countryRaw = req.nextUrl.searchParams.get("countryIso2")?.trim()
  const countryIso2 = countryRaw ? normalizeVisitorCountryIso2(countryRaw) : null
  if (!countryIso2) {
    return NextResponse.json({ error: "invalid_country" }, { status: 400 })
  }

  const locale = req.nextUrl.searchParams.get("locale") === "en" ? "en" : "fr"
  const kind = parseEmailKind(req.nextUrl.searchParams.get("kind"))
  const orderId = req.nextUrl.searchParams.get("orderId")?.trim() || undefined
  const sampleOrder = req.nextUrl.searchParams.get("sampleOrder") === "1"

  const useLastOrder = req.nextUrl.searchParams.get("useLastOrder") === "1"

  const previewOrderContext =
    kind === "graduated"
      ? await loadExpansionGraduationPreviewOrder({
          countryIso2,
          orderId,
          useSampleOrder: sampleOrder && !orderId,
          useLastOrder: useLastOrder && !orderId,
        })
      : null

  const html = await renderExpansionBuyerEmailHtml({
    kind,
    countryIso2,
    locale,
    previewOrderContext,
  })

  console.log("[expansion-rollout]", {
    userId: gate.session.user.id,
    countryIso2,
    locale,
    kind,
    orderId: previewOrderContext?.orderId ?? null,
    result: "expansion_email_preview",
  })

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  })
}
