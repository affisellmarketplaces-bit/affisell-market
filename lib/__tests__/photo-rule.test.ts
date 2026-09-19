import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

/**
 * PHOTO RULE — nothing written may sit on a product photo and hide it.
 * Text badges (sales, offer, discount, "Best Seller"…) live in the info area or in a band around the photo;
 * only icon-only controls (like-heart, full-screen) may touch it. These static checks stop the rule from
 * silently regressing. (Full-bleed social feeds — Pulse — are a different, media-first surface and exempt.)
 */
const ROOTS = ["app", "components"]
const EXEMPT = [/^components\/pulse\//]

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full, out)
    else if (/\.(tsx)$/.test(e.name)) out.push(full)
  }
  return out
}
const files = ROOTS.flatMap((r) => walk(r)).filter((f) => !EXEMPT.some((re) => re.test(f.replace(/\\/g, "/"))))
const read = (f: string) => fs.readFileSync(f, "utf8")

describe("photo rule (no text over product photos)", () => {
  it("never renders the sales / offer badges as photo overlays", () => {
    const offenders = files.filter((f) => /<Product(Sales|Offer)Badge[^>]*variant="overlay"/.test(read(f)))
    expect(offenders).toEqual([])
  })

  it("never places the discount tag on a photo (it is inline in the price row)", () => {
    const allowed = new Set(["components/product-discount-tag.tsx"])
    const offenders = files.filter((f) => !allowed.has(f.replace(/\\/g, "/")) && /<ProductDiscountTag\b/.test(read(f)))
    expect(offenders).toEqual([])
  })

  it("the photo gallery components expose no overlay slot", () => {
    for (const f of [
      "components/product/product-media-gallery.tsx",
      "components/product/mobile-product-gallery-carousel.tsx",
      "components/product-image-hover-zoom.tsx",
    ]) {
      expect(read(f), f).not.toMatch(/\boverlay\?:\s*ReactNode/)
    }
  })

  it("benefit chips have no overlay layout", () => {
    expect(read("components/product/product-highlight-chips.tsx")).not.toMatch(/"overlay"/)
  })

  it("the hover-zoom and gallery never write hint text over the image", () => {
    const zoom = read("components/product-image-hover-zoom.tsx")
    expect(zoom).not.toMatch(/hoverZoomHint|zoomDetailLevel/)
    const gallery = read("components/product/product-media-gallery.tsx")
    // the full-view button is in the bottom band under the stage, not absolutely positioned on it
    expect(gallery).not.toMatch(/absolute bottom-4 left-4[^"]*"[^>]*>\s*<Maximize2/)
  })
})
