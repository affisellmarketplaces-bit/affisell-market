import { NextResponse } from "next/server"

import { rateLimitClientKey, rateLimitResponseAsync } from "@/lib/api-rate-limit"
import { fetchCitySuggestions } from "@/lib/city-suggest"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ISO2_RE = /^[a-zA-Z]{2}$/
const MIN_QUERY_LEN = 2
const MAX_QUERY_LEN = 80

/** Public, unauthenticated — same class of endpoint as /api/marketplace/search-by-photo. */
export async function GET(req: Request) {
  const limited = await rateLimitResponseAsync(rateLimitClientKey(req), {
    limit: 20,
    windowMs: 60_000,
    prefix: "city-suggest",
  })
  if (limited) return limited

  const { searchParams } = new URL(req.url)
  const query = (searchParams.get("q") ?? "").trim().slice(0, MAX_QUERY_LEN)
  const countryParam = searchParams.get("country")?.trim() ?? ""
  const countryCode = ISO2_RE.test(countryParam) ? countryParam.toUpperCase() : null
  const locale = searchParams.get("locale")?.trim().slice(0, 10) || "en"

  if (query.length < MIN_QUERY_LEN) {
    return NextResponse.json({ suggestions: [] })
  }

  const suggestions = await fetchCitySuggestions(query, countryCode, locale)
  return NextResponse.json({ suggestions })
}
