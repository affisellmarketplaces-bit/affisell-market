import {
  buildSeoParasiteSitemapXml,
  loadSeoParasiteSitemapRows,
} from "@/lib/seo-parasite.server"

export const revalidate = 3600

export async function GET() {
  const rows = await loadSeoParasiteSitemapRows()
  const xml = buildSeoParasiteSitemapXml(rows)

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  })
}
