import fs from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const LOCALES = ["fr", "en", "de", "es", "it", "nl", "pl", "zh"] as const

type Tree = { [k: string]: string | Tree }
function load(locale: string) {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../messages/${locale}.json`), "utf8")) as {
    storefront: { hero: Record<string, string>; search: Record<string, string>; buyerChrome: Record<string, string> } & Tree
  }
}

// next-intl throws at render time on a missing key — and the hero / search sit on every storefront page.
describe("storefront hero + search strings", () => {
  const en = load("en").storefront

  it.each(LOCALES)("%s has every hero key, non-empty, with the variables the component passes", (locale) => {
    const { hero } = load(locale).storefront
    expect(Object.keys(hero).sort()).toEqual(Object.keys(en.hero).sort())
    for (const [k, v] of Object.entries(hero)) expect(v.trim().length, `${locale}:hero.${k}`).toBeGreaterThan(0)
    expect(hero.ariaLabel).toContain("{name}")
    expect(hero.eyebrow).toContain("{count")
    expect(hero.chipSales).toContain("{count")
  })

  it.each(LOCALES)("%s has every search key, with {query} in the empty state", (locale) => {
    const { search, buyerChrome } = load(locale).storefront
    expect(Object.keys(search).sort()).toEqual(Object.keys(en.search).sort())
    for (const [k, v] of Object.entries(search)) expect(v.trim().length, `${locale}:search.${k}`).toBeGreaterThan(0)
    expect(search.empty).toContain("{query}")
    expect(buyerChrome.search?.trim().length ?? 0, `${locale}:buyerChrome.search`).toBeGreaterThan(0)
  })
})
