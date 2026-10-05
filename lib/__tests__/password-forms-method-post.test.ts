import fs from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const ROOT = path.resolve(__dirname, "../..")

function tsxFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) return []
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? tsxFiles(full) : entry.name.endsWith(".tsx") ? [full] : []
  })
}

const passwordFiles = [...tsxFiles(path.join(ROOT, "app")), ...tsxFiles(path.join(ROOT, "components"))].filter((f) =>
  fs.readFileSync(f, "utf8").includes('type="password"')
)

describe("forms that hold a password", () => {
  it("finds the password forms", () => {
    expect(passwordFiles.length).toBeGreaterThan(5)
  })

  // A <form> without method="post" submits as a GET when the click lands before React hydrates (slow network, cold
  // dev server, blocked scripts): every named field — the password — is written into the URL and the page reloads.
  it.each(passwordFiles.map((f) => [path.relative(ROOT, f), f] as const))(
    "%s: every <form> declares method=\"post\"",
    (_name, file) => {
      const src = fs.readFileSync(file, "utf8")
      const forms = (src.match(/<form[\s>]/g) ?? []).length
      const posts = (src.match(/<form[^>]*?\bmethod="post"|<form\s*\n(?:[^>]*\n)*?\s*method="post"/g) ?? []).length
      expect(posts).toBeGreaterThanOrEqual(forms)
    }
  )
})
