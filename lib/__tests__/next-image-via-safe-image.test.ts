import fs from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const ROOT = path.resolve(__dirname, "../..")

function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name === "node_modules" || e.name.startsWith(".")) return []
    const full = path.join(dir, e.name)
    return e.isDirectory() ? sources(full) : /\.(tsx?|jsx?)$/.test(e.name) ? [full] : []
  })
}

describe("images go through SafeImage", () => {
  // `next/image` throws on an unconfigured host and takes the page section down. Components must import the drop-in
  // `@/components/ui/safe-image` (same props); only that file talks to `next/image` directly.
  it("no module imports next/image except components/ui/safe-image.tsx", () => {
    const offenders = ["app", "components", "lib"]
      .flatMap((d) => sources(path.join(ROOT, d)))
      .filter((f) => !f.includes(`${path.sep}__tests__${path.sep}`))
      .filter((f) => path.relative(ROOT, f) !== path.join("components", "ui", "safe-image.tsx"))
      .filter((f) => /from\s+["']next\/image["']/.test(fs.readFileSync(f, "utf8")))
      .map((f) => path.relative(ROOT, f))
    expect(offenders).toEqual([])
  })
})
