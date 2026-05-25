import { normalizeRequestHost } from "@/lib/custom-domain-host"
import { resolveStoreByCustomDomain } from "@/lib/store-custom-domain"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const host = normalizeRequestHost(url.searchParams.get("host") ?? req.headers.get("host"))
  if (!host) {
    return Response.json({ error: "host required" }, { status: 400 })
  }

  const resolved = await resolveStoreByCustomDomain(host)
  if (!resolved) {
    return Response.json({ found: false }, {
      status: 404,
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    })
  }

  return Response.json(
    {
      found: true,
      slug: resolved.slug,
      role: resolved.role,
      storePrefix: resolved.storePrefix,
    },
    {
      headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" },
    }
  )
}
