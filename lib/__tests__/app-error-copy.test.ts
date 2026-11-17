import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { APP_ERROR_COPY } from "@/lib/app-error-copy"
import { SUPPORTED_LOCALES } from "@/lib/i18n-locale"

const root = path.resolve(__dirname, "../..")

describe("route error page copy", () => {
  it.each(SUPPORTED_LOCALES)("%s matches messages/*.json errors.page", (locale) => {
    const messages = JSON.parse(readFileSync(path.join(root, "messages", `${locale}.json`), "utf8"))
    expect(APP_ERROR_COPY[locale]).toEqual(messages.errors.page)
  })

  it("no client component imports a whole message catalogue (it ships with every page)", () => {
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.name === "node_modules" || e.name.startsWith(".") || e.name === "__tests__") continue
        const p = path.join(dir, e.name)
        if (e.isDirectory()) walk(p)
        else if (/\.(tsx?|jsx?)$/.test(e.name)) {
          const src = readFileSync(p, "utf8")
          if (/^\s*["']use client["']/.test(src) && /from\s+["']@\/messages\/[a-z]{2}\.json["']/.test(src)) offenders.push(path.relative(root, p))
        }
      }
    }
    for (const d of ["app", "components", "hooks", "lib"]) walk(path.join(root, d))
    expect(offenders).toEqual([])
  })
})
