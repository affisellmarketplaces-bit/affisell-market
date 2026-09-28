import { describe, expect, it } from "vitest"

import { shapeCitySuggestions, shapeGoogleCitySuggestions } from "@/lib/city-suggest"

function feature(name: string, countrycode: string, state: string | undefined, lon: number, lat: number) {
  return {
    properties: { osm_value: "city", name, countrycode, state },
    geometry: { coordinates: [lon, lat] as [number, number] },
  }
}

function postcodeFeature(postcode: string, city: string, countrycode: string, state: string | undefined, lon: number, lat: number) {
  return {
    properties: { osm_value: "postcode", name: postcode, city, countrycode, state },
    geometry: { coordinates: [lon, lat] as [number, number] },
  }
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

  it("resolves a postcode entry to its real city name via properties.city, with the postcode in the label", () => {
    const out = shapeCitySuggestions(
      [postcodeFeature("13003", "Marseille", "FR", "Provence-Alpes-Côte d'Azur", 5.38, 43.31)],
      null
    )
    expect(out).toEqual([
      {
        label: "Marseille (13003), Provence-Alpes-Côte d'Azur",
        city: "Marseille",
        region: "Provence-Alpes-Côte d'Azur",
        countryCode: "FR",
        lat: 43.31,
        lon: 5.38,
      },
    ])
  })

  it("drops a postcode entry that has no city tagged", () => {
    const out = shapeCitySuggestions([{ properties: { osm_value: "postcode", name: "12345", countrycode: "KW" }, geometry: { coordinates: [1, 2] } }], null)
    expect(out).toEqual([])
  })
})

describe("shapeGoogleCitySuggestions", () => {
  function prediction(text: string, mainText: string, secondaryText?: string) {
    return {
      placePrediction: {
        text: { text },
        structuredFormat: { mainText: { text: mainText }, secondaryText: secondaryText ? { text: secondaryText } : undefined },
      },
    }
  }

  it("maps a Google prediction into a labeled suggestion with no coordinates", () => {
    const out = shapeGoogleCitySuggestions([prediction("Paris, France", "Paris", "France")], "FR")
    expect(out).toEqual([
      { label: "Paris, France", city: "Paris", region: "France", countryCode: "FR", lat: null, lon: null },
    ])
  })

  it("falls back to an empty countryCode when none was requested", () => {
    const out = shapeGoogleCitySuggestions([prediction("Paris, France", "Paris", "France")], null)
    expect(out[0]).toMatchObject({ countryCode: "" })
  })

  it("drops predictions missing a main text or full text", () => {
    const out = shapeGoogleCitySuggestions(
      [{ placePrediction: { structuredFormat: { mainText: { text: "No Full Text" } } } }, { placePrediction: { text: { text: "No Main Text" } } }],
      null
    )
    expect(out).toEqual([])
  })

  it("de-duplicates identical labels", () => {
    const out = shapeGoogleCitySuggestions([prediction("Paris, France", "Paris", "France"), prediction("Paris, France", "Paris", "France")], null)
    expect(out).toHaveLength(1)
  })
})
