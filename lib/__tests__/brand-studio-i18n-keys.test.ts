import fs from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const LOCALES = ["fr", "en", "de", "es", "it", "nl", "pl", "zh"] as const

type Tree = { [k: string]: string | Tree }
function flatten(tree: Tree, prefix = ""): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((acc, [k, v]) => {
    if (typeof v === "string") acc[`${prefix}${k}`] = v
    else Object.assign(acc, flatten(v, `${prefix}${k}.`))
    return acc
  }, {})
}

function brandStudioKeys(locale: string): Record<string, string> {
  const file = path.resolve(__dirname, `../../messages/${locale}.json`)
  const messages = JSON.parse(fs.readFileSync(file, "utf8")) as { storefront: { brandStudio: Tree } }
  const bs = messages.storefront.brandStudio
  return flatten({ history: bs.history, draft: bs.draft, palette: bs.palette, shortcuts: bs.shortcuts } as Tree)
}

// A missing key makes next-intl throw at render time (it took the catalogue page down once already), so every locale
// must carry the full set — and the variables each string interpolates.
describe("Brand Studio history / draft / palette strings", () => {
  const reference = brandStudioKeys("en")

  it("has the expected keys", () => {
    expect(Object.keys(reference).sort()).toEqual(
      [
        "draft.body", "draft.discard", "draft.relativeNow", "draft.restore", "draft.restored", "draft.title",
        "history.label", "history.redo", "history.redoTitle", "history.undo", "history.undoTitle",
        "palette.accent", "palette.applied", "palette.apply", "palette.aa", "palette.current", "palette.derived",
        "palette.hint", "palette.primary", "palette.title",
        "shortcuts.save",
      ].sort()
    )
  })

  it.each(LOCALES)("%s has every key, non-empty, with the {when} variable in draft.body", (locale) => {
    const keys = brandStudioKeys(locale)
    expect(Object.keys(keys).sort()).toEqual(Object.keys(reference).sort())
    for (const [k, v] of Object.entries(keys)) expect(v.trim().length, `${locale}:${k}`).toBeGreaterThan(0)
    expect(keys["draft.body"]).toContain("{when}")
  })
})
