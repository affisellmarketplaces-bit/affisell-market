import fs from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const CONTENT_DIR = path.resolve(__dirname, "../../legal/content")

function markdownFiles(): string[] {
  return fs.readdirSync(CONTENT_DIR).flatMap((locale) => {
    const dir = path.join(CONTENT_DIR, locale)
    if (!fs.statSync(dir).isDirectory()) return []
    return fs.readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => path.join(dir, f))
  })
}

describe("legal content markup", () => {
  const files = markdownFiles()

  it("finds the localized legal documents", () => {
    expect(files.length).toBeGreaterThan(8)
  })

  // `<mailto:{{EMAIL}}>{{EMAIL}}</mailto>` is not Markdown: the renderer prints it as literal text, one unbreakable
  // 60-character token that spills off a phone screen. A bare address (GFM autolinks it) or `[x](mailto:x)` is right.
  it.each(files.map((f) => [path.relative(CONTENT_DIR, f), f] as const))(
    "%s has no pseudo-HTML mailto tags",
    (_name, file) => {
      expect(fs.readFileSync(file, "utf8")).not.toMatch(/<\/?mailto\b/i)
    }
  )
})
