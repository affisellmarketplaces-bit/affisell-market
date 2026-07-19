import { describe, expect, it, vi } from "vitest"

import {
  marketplacesForCountry,
  parseRadarCountries,
  runParallelCountryCrawls,
  type CountryCrawlResult,
} from "@/lib/radar/crawler/global-scan"
import {
  normalizeFromSnapshot,
  currencyForCountry,
} from "@/lib/radar/writers/standard-product-normalize"

describe("parseRadarCountries", () => {
  it("defaults to FR/US/MX/DE/GB", () => {
    const prev = process.env.RADAR_COUNTRIES
    delete process.env.RADAR_COUNTRIES
    expect(parseRadarCountries()).toEqual(["FR", "US", "MX", "DE", "GB"])
    if (prev === undefined) delete process.env.RADAR_COUNTRIES
    else process.env.RADAR_COUNTRIES = prev
  })

  it("parses query string", () => {
    expect(parseRadarCountries("fr,us,mx")).toEqual(["FR", "US", "MX"])
  })
})

describe("marketplacesForCountry", () => {
  it("adds Shopee only for SEA", () => {
    expect(marketplacesForCountry("FR")).toEqual(["tiktok_shop", "amazon"])
    expect(marketplacesForCountry("MY")).toContain("shopee")
  })
})

describe("runParallelCountryCrawls", () => {
  it("keeps other countries when one rejects", async () => {
    const crawlFn = vi.fn(async (country: string): Promise<CountryCrawlResult> => {
      if (country === "US") {
        throw new Error("US connector down")
      }
      return {
        country,
        snapshots: country === "FR" ? 10 : 5,
        products: country === "FR" ? 10 : 5,
        new: 1,
        updated: 0,
        errors: [],
      }
    })

    const jobs = await runParallelCountryCrawls(["FR", "US", "MX"], crawlFn)
    expect(jobs).toHaveLength(3)
    expect(jobs.find((j) => j.country === "FR")?.snapshots).toBe(10)
    expect(jobs.find((j) => j.country === "MX")?.snapshots).toBe(5)
    expect(jobs.find((j) => j.country === "US")?.errors[0]).toContain("US connector down")
    expect(crawlFn).toHaveBeenCalledTimes(3)
  })
})

describe("cross-country StandardProduct", () => {
  it("same externalId yields different currency/price per country", () => {
    const fr = normalizeFromSnapshot({
      title: "Wireless Earbuds",
      price: 29.9,
      currency: null,
      marketplaceId: "amazon",
      country: "FR",
      externalId: "B0SAME",
      url: "https://www.amazon.fr/dp/B0SAME",
    })
    const us = normalizeFromSnapshot({
      title: "Wireless Earbuds",
      price: 24.99,
      currency: null,
      marketplaceId: "amazon",
      country: "US",
      externalId: "B0SAME",
      url: "https://www.amazon.com/dp/B0SAME",
    })
    expect(fr).not.toBeNull()
    expect(us).not.toBeNull()
    expect(fr!.externalId).toBe(us!.externalId)
    expect(fr!.currency).toBe("EUR")
    expect(us!.currency).toBe("USD")
    expect(currencyForCountry("MX")).toBe("MXN")
    expect(fr!.price).not.toBe(us!.price)
  })
})
