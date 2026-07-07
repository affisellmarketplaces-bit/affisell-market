import { expect, test, type APIRequestContext } from "@playwright/test"

type CategoryTreeNode = {
  id: string
  slug: string
  count: number
  subcategories?: Array<{ id: string; slug: string; count: number }>
}

async function resolveBrowsableCategory(
  request: APIRequestContext
): Promise<{ slug: string; id: string } | null> {
  const res = await request.get("/api/categories")
  if (!res.ok()) return null

  const data = (await res.json()) as { categories?: CategoryTreeNode[] }
  const candidates: Array<{ slug: string; id: string }> = []

  for (const cat of data.categories ?? []) {
    for (const node of [cat, ...(cat.subcategories ?? [])]) {
      if (node.count > 0 && node.slug?.trim() && node.id?.trim()) {
        candidates.push({ slug: node.slug.trim(), id: node.id.trim() })
      }
    }
  }

  for (const node of candidates) {
    const probe = await request.get(`/browse/${encodeURIComponent(node.slug)}`)
    if (probe.status() === 200) return node
  }

  return null
}

test.describe("browse category SEO", () => {
  test("GET /browse/{slug} returns indexable HTML with canonical metadata", async ({ request }) => {
    const category = await resolveBrowsableCategory(request)
    test.skip(!category, "No indexable category in catalog")

    const path = `/browse/${encodeURIComponent(category!.slug)}`
    const res = await request.get(path)
    expect(res.status(), `${path} returned ${res.status()}`).toBe(200)

    const html = await res.text()
    const escapedSlug = category!.slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    expect(html).toMatch(
      new RegExp(
        `<link[^>]+rel=["']canonical["'][^>]+href=["'][^"']*/browse/${escapedSlug}`,
        "i"
      )
    )
    expect(html).toContain('type="application/ld+json"')
    expect(html).toMatch(/<h1\b/i)
    expect(html).toMatch(/Breadcrumb/i)
    expect(html).toMatch(/Browse full catalog|Voir tout le catalogue/i)
  })

  test("unknown browse slug returns 404", async ({ request }) => {
    const res = await request.get("/browse/affisell-nonexistent-category-slug-xyz")
    expect(res.status()).toBe(404)
  })

  test("legacy /shops/browse?category= redirects to /browse/{slug}", async ({ request }) => {
    const category = await resolveBrowsableCategory(request)
    test.skip(!category, "No indexable category in catalog")

    const res = await request.get(`/shops/browse?category=${encodeURIComponent(category!.id)}`, {
      maxRedirects: 0,
    })
    expect([301, 302, 307, 308]).toContain(res.status())
    const location = res.headers().location ?? ""
    expect(location).toContain(`/browse/${encodeURIComponent(category!.slug)}`)
  })
})
