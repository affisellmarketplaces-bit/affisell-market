import { describe, expect, it } from "vitest"

import { shapeCitySuggestions } from "@/lib/city-suggest"

function feature(name: string, countrycode: string, state: string | undefined, lon: number, lat: number) {
  return { properties: { name, countrycode, state }, geometry: { coordinates: [lon, lat] as [number, number] } }
}

describe("shapeCitySuggestions", () => {
  it("maps a Photon feature into a labeled suggestion", () => {
    const out = shapeCitySuggestions([feature("Paris", "FR", "Île-de-France", 2.3522, 48.8566)], null)
    expect(out).toEqual([
      { label: "Paris, Île-de-France", city: "Paris", region: "Île-de-France", countryCode: "FR", lat: 48.8566, lon: 2.3522 },
    ])
  })

  it("omits region when state is absent", () => {
    const out = shapeCitySuggestions([feature("Solo City", "US", undefined, 2, 1)], null)
    expect(out[0]).toMatchObject({ label: "Solo City", region: null })
  })

  it("drops features missing a name, country code, or coordinates", () => {
    const out = shapeCitySuggestions(
      [
        { properties: { countrycode: "FR" }, geometry: { coordinates: [2, 1] } },
        { properties: { name: "No Country" }, geometry: { coordinates: [2, 1] } },
        { properties: { name: "No Coords", countrycode: "FR" }, geometry: {} },
      ],
      null
    )
    expect(out).toEqual([])
  })

  it("de-duplicates same city + country + region across features", () => {
    const out = shapeCitySuggestions(
      [feature("Paris", "FR", "Île-de-France", 2.35, 48.85), feature("paris", "FR", "île-de-france", 2.36, 48.86)],
      null
    )
    expect(out).toHaveLength(1)
  })

  it("keeps distinct cities with the same name in different regions", () => {
    const out = shapeCitySuggestions([feature("Paris", "US", "Texas", -95.5, 33.66), feature("Paris", "FR", "Île-de-France", 2.35, 48.85)], null)
    expect(out).toHaveLength(2)
  })

  it("scopes results to the requested country when it has matches", () => {
    const out = shapeCitySuggestions(
      [feature("Berlin", "DE", undefined, 13.4, 52.5), feature("Bern", "CH", undefined, 7.45, 46.95)],
      "DE"
    )
    expect(out).toEqual([expect.objectContaining({ city: "Berlin", countryCode: "DE" })])
  })

  it("falls back to the unscoped list when nothing matches the requested country", () => {
    const out = shapeCitySuggestions([feature("Bern", "CH", undefined, 7.45, 46.95)], "DE")
    expect(out).toEqual([expect.objectContaining({ city: "Bern", countryCode: "CH" })])
  })
})
