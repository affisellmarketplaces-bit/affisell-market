import { describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"

const root = path.resolve(__dirname, "../..")

const REQUIRED_BRAND_ASSETS = [
  "public/brand/affisell-mark.svg",
  "public/brand/affisell-mark-maskable.svg",
  "public/icons/icon-192.png",
  "public/icons/icon-512.png",
  "public/icons/icon-maskable-512.png",
  "app/icon.png",
  "app/icon.svg",
  "app/apple-icon.png",
  "public/splash/apple-splash-1170-2532.png",
  "public/splash/apple-splash-1284-2778.png",
]

describe("brand icons", () => {
  it("ships Affisell favicon and PWA assets", () => {
    for (const rel of REQUIRED_BRAND_ASSETS) {
      const abs = path.join(root, rel)
      expect(fs.existsSync(abs), `missing ${rel}`).toBe(true)
      expect(fs.statSync(abs).size, `${rel} is empty`).toBeGreaterThan(100)
    }
  })

  it("does not ship the default Next.js favicon.ico", () => {
    const legacy = path.join(root, "app/favicon.ico")
    expect(fs.existsSync(legacy)).toBe(false)
  })
})
