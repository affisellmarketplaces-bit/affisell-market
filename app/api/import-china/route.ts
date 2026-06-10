import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { AGENTS, PLATFORMS } from "@/lib/agents"
import { handleSupplierImportUrl } from "@/lib/supplier-import-url-handler"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Import Chine avec agent d'achat choisi (Superbuy, Anovabuy, …).
 * Reçoit { url, agent, platform, options } — l'agent/plateforme sont validés,
 * loggés pour Metabase, puis l'import délègue au handler URL existant
 * (OneBound pour 1688, scraping pour le reste). Idempotent : pré-remplit
 * la fiche, ne crée rien en base.
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  const role = (session.user as { role?: string }).role
  if (role !== "SUPPLIER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = (await req.json().catch(() => null)) as {
    url?: string
    agent?: string
    platform?: string
    options?: { markup?: number; aiRewrite?: boolean }
  } | null
  if (!body || typeof body.url !== "string" || !/^https?:\/\//i.test(body.url.trim())) {
    return NextResponse.json({ error: "invalid_url" }, { status: 400 })
  }

  const agent = AGENTS.find((a) => a.id === body.agent) ?? null
  const platform =
    typeof body.platform === "string" && PLATFORMS.includes(body.platform)
      ? body.platform
      : null
  if (body.agent && !agent) {
    return NextResponse.json({ error: "unknown_agent" }, { status: 400 })
  }

  console.log("[import-china]", {
    userId: session.user.id,
    agent: agent?.id ?? null,
    platform,
    result: "import_requested",
  })

  const res = await handleSupplierImportUrl(session.user.id, {
    url: body.url,
    options: body.options,
  })

  // Renvoie le choix d'agent au client pour affichage (badge récap).
  if (res instanceof NextResponse && res.ok && agent) {
    const payload = (await res.json()) as Record<string, unknown>
    return NextResponse.json({
      ...payload,
      buyingAgent: { id: agent.id, name: agent.name, fee: agent.fee },
      chinaPlatform: platform,
    })
  }
  return res
}
