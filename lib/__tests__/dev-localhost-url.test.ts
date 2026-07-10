import { describe, expect, it } from "vitest"
import {
  DEFAULT_DEV_PORT,
  devLocalhostOrigin,
  devLocalhostUrl,
  resolveDevPort,
} from "@/lib/dev-localhost-url"

describe("dev-localhost-url", () => {
  it("defaults to port 3001", () => {
    expect(DEFAULT_DEV_PORT).toBe(3001)
    expect(resolveDevPort({})).toBe(3001)
    expect(devLocalhostOrigin({})).toBe("http://localhost:3001")
  })

  it("respects PORT env", () => {
    expect(resolveDevPort({ PORT: "4000" })).toBe(4000)
    expect(devLocalhostUrl("/api/health", { PORT: "4000" })).toBe("http://localhost:4000/api/health")
  })

  it("builds path + query for wizard v2", () => {
    expect(devLocalhostUrl("/dashboard/supplier/products/new?wizard=v2&compose=1")).toBe(
      "http://localhost:3001/dashboard/supplier/products/new?wizard=v2&compose=1"
    )
  })
})
