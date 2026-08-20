import { NextResponse, type NextRequest } from "next/server"

function isMerchantLeanBlockedPath(barePath: string): boolean {
  return (
    barePath === "/dashboard" ||
    barePath.startsWith("/dashboard/") ||
    barePath.startsWith("/api/supplier/") ||
    barePath.startsWith("/api/affiliate/") ||
    barePath.startsWith("/api/requests")
  )
}

/** Dev buyer-lean — reject merchant traffic so webpack serves buyer routes first. */
export function devLeanBlockedResponse(
  req: NextRequest,
  barePath: string
): NextResponse | null {
  if (process.env.AFFISELL_DEV_LEAN !== "1") return null
  if (!isMerchantLeanBlockedPath(barePath)) return null

  const accepts = req.headers.get("accept") ?? ""
  if (barePath.startsWith("/api/") || accepts.includes("application/json")) {
    return NextResponse.json(
      {
        error: "dev_buyer_lean",
        message: "Merchant API paused in buyer-lean dev. Run npm run dev for dashboard work.",
      },
      { status: 503, headers: { "cache-control": "no-store" } }
    )
  }

  return new NextResponse(
    `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/><title>Affisell — mode buyer</title></head><body style="font-family:system-ui,sans-serif;padding:2rem;max-width:36rem;margin:auto;line-height:1.5"><h1>Mode buyer-lean actif</h1><p>Fermez cet onglet dashboard. Utilisez <strong>un seul onglet</strong> sur <a href="/">http://localhost:3001/</a>.</p><p>Pour le travail supplier/affiliate : <code>npm run dev</code> (sans lean).</p></body></html>`,
    {
      status: 503,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    }
  )
}

export { isMerchantLeanBlockedPath }
