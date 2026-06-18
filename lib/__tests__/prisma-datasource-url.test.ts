import { afterEach, describe, expect, it } from "vitest"

import {
  augmentPrismaDatasourceUrl,
  neonDirectHostToPooler,
  normalizePrismaRawUrl,
} from "@/lib/prisma-datasource-url"

describe("augmentPrismaDatasourceUrl", () => {
  const prevEnv = process.env.NODE_ENV

  afterEach(() => {
    process.env.NODE_ENV = prevEnv
    delete process.env.PRISMA_CONNECTION_LIMIT
  })

  it("adds pool params for Neon pooler host", () => {
    process.env.NODE_ENV = "development"
    const raw =
      "postgresql://user:pass@ep-foo-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
    const out = augmentPrismaDatasourceUrl(raw)
    const url = new URL(out)
    expect(url.searchParams.get("pgbouncer")).toBe("true")
    expect(url.searchParams.get("connection_limit")).toBe("20")
    expect(url.searchParams.get("pool_timeout")).toBe("60")
    expect(url.searchParams.get("connect_timeout")).toBe("30")
  })

  it("bumps low dev connection_limit on pooler URLs", () => {
    process.env.NODE_ENV = "development"
    const raw =
      "postgresql://user:pass@ep-foo-pooler.us-east-2.aws.neon.tech/neondb?connection_limit=5&pool_timeout=10"
    const out = augmentPrismaDatasourceUrl(raw)
    const url = new URL(out)
    expect(url.searchParams.get("connection_limit")).toBe("20")
    expect(url.searchParams.get("pool_timeout")).toBe("10")
  })

  it("adds connection limits for local Postgres in development without pgbouncer", () => {
    process.env.NODE_ENV = "development"
    const raw = "postgresql://user:pass@localhost:5432/mydb"
    const out = augmentPrismaDatasourceUrl(raw)
    const url = new URL(out)
    expect(url.searchParams.get("pgbouncer")).toBeNull()
    expect(url.searchParams.get("connection_limit")).toBe("20")
    expect(url.searchParams.get("pool_timeout")).toBe("60")
  })

  it("does not add pgbouncer on direct Neon host in development", () => {
    process.env.NODE_ENV = "development"
    const raw =
      "postgresql://user:pass@ep-foo.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"
    const out = augmentPrismaDatasourceUrl(raw)
    const url = new URL(out)
    expect(url.searchParams.get("pgbouncer")).toBeNull()
    expect(url.searchParams.get("connect_timeout")).toBe("30")
  })

  it("leaves non-pooler URLs unchanged in production", () => {
    process.env.NODE_ENV = "production"
    const raw = "postgresql://user:pass@localhost:5432/mydb"
    expect(augmentPrismaDatasourceUrl(raw)).toBe(raw)
  })
})

describe("normalizePrismaRawUrl", () => {
  const prevEnv = process.env.NODE_ENV
  const prevDirect = process.env.PRISMA_USE_DIRECT_DEV

  afterEach(() => {
    process.env.NODE_ENV = prevEnv
    if (prevDirect === undefined) delete process.env.PRISMA_USE_DIRECT_DEV
    else process.env.PRISMA_USE_DIRECT_DEV = prevDirect
  })

  it("rewrites direct Neon host to pooler in development", () => {
    process.env.NODE_ENV = "development"
    delete process.env.PRISMA_USE_DIRECT_DEV
    const raw =
      "postgresql://user:pass@ep-misty-sea-al1ne07p.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"
    const out = normalizePrismaRawUrl(raw)
    const url = new URL(out)
    expect(url.hostname).toBe("ep-misty-sea-al1ne07p-pooler.c-3.eu-central-1.aws.neon.tech")
    expect(url.searchParams.get("pgbouncer")).toBe("true")
  })

  it("keeps direct host when PRISMA_USE_DIRECT_DEV=1", () => {
    process.env.NODE_ENV = "development"
    process.env.PRISMA_USE_DIRECT_DEV = "1"
    const raw =
      "postgresql://user:pass@ep-misty-sea-al1ne07p.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"
    expect(normalizePrismaRawUrl(raw)).toBe(raw)
  })
})

describe("neonDirectHostToPooler", () => {
  it("inserts -pooler before region segment", () => {
    expect(
      neonDirectHostToPooler("ep-misty-sea-al1ne07p.c-3.eu-central-1.aws.neon.tech")
    ).toBe("ep-misty-sea-al1ne07p-pooler.c-3.eu-central-1.aws.neon.tech")
  })
})
