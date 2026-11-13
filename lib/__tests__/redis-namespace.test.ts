import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

import { describe, expect, it } from "vitest"

import { bullmqPrefix, BULLMQ_DEFAULT_PREFIX, redisKey, redisNamespace, redisNamespacePrefix } from "@/lib/redis-namespace"

describe("redis namespace — Preview and Production never share a key", () => {
  it("production keeps EVERY existing key and BullMQ's default prefix (nothing to migrate)", () => {
    const env = { VERCEL_ENV: "production", NODE_ENV: "production" }
    expect(redisNamespacePrefix(env)).toBe("")
    expect(redisKey("affisell:shield:ban:1.2.3.4", env)).toBe("affisell:shield:ban:1.2.3.4")
    expect(redisKey("rl:tryon:ip:1.2.3.4", env)).toBe("rl:tryon:ip:1.2.3.4")
    expect(bullmqPrefix(env)).toBe("bull")
    expect(BULLMQ_DEFAULT_PREFIX).toBe("bull")
  })

  it("a Preview gets its own namespace (keys AND queues) although NODE_ENV is 'production' there too", () => {
    const env = { VERCEL_ENV: "preview", NODE_ENV: "production" }
    expect(redisKey("affisell:shield:ban:1.2.3.4", env)).toBe("preview:affisell:shield:ban:1.2.3.4")
    expect(bullmqPrefix(env)).toBe("preview:bull")
    expect(redisKey("affisell:shield:ban:1.2.3.4", env)).not.toBe(redisKey("affisell:shield:ban:1.2.3.4", { VERCEL_ENV: "production" }))
  })

  it("development and test are isolated from both", () => {
    expect(redisKey("k", { NODE_ENV: "development" })).toBe("dev:k")
    expect(redisKey("k", { VERCEL_ENV: "development" })).toBe("dev:k")
    expect(redisKey("k", { NODE_ENV: "test" })).toBe("test:k")
    expect(bullmqPrefix({ NODE_ENV: "development" })).toBe("dev:bull")
  })

  it("the self-hosted production worker (NODE_ENV=production, no VERCEL_ENV) shares Vercel Production's namespace — it must consume its queues", () => {
    expect(bullmqPrefix({ NODE_ENV: "production" })).toBe("bull")
    expect(redisKey("k", { NODE_ENV: "production" })).toBe("k")
  })

  it("redis glob patterns are namespaced the same way (KEYS affisell:shield:ban:*)", () => {
    expect(redisKey("affisell:shield:ban:*", { VERCEL_ENV: "preview" })).toBe("preview:affisell:shield:ban:*")
  })

  describe("AFFISELL_REDIS_NAMESPACE", () => {
    it("lets a worker serve Preview's queues, or pins an environment to its own explicit namespace", () => {
      expect(bullmqPrefix({ NODE_ENV: "production", AFFISELL_REDIS_NAMESPACE: "preview" })).toBe("preview:bull")
      expect(redisKey("k", { VERCEL_ENV: "preview", AFFISELL_REDIS_NAMESPACE: "qa-1" })).toBe("qa-1:k")
    })

    it("can never pull a Preview / Development / test runtime INTO the production namespace", () => {
      expect(redisKey("k", { VERCEL_ENV: "preview", AFFISELL_REDIS_NAMESPACE: "production" })).toBe("preview:k")
      expect(redisKey("k", { VERCEL_ENV: "preview", AFFISELL_REDIS_NAMESPACE: "prod" })).toBe("preview:k")
      expect(redisKey("k", { NODE_ENV: "development", AFFISELL_REDIS_NAMESPACE: "production" })).toBe("dev:k")
      expect(bullmqPrefix({ VERCEL_ENV: "preview", AFFISELL_REDIS_NAMESPACE: " Production " })).toBe("preview:bull")
    })

    it("production may name itself 'production' explicitly (still the empty namespace)", () => {
      expect(redisKey("k", { VERCEL_ENV: "production", AFFISELL_REDIS_NAMESPACE: "production" })).toBe("k")
    })

    it.each(["has space", "UPPER*", "a:b", "x".repeat(25), "-lead", "glob*", "a/b"])("ignores an invalid value %j", (bad) => {
      expect(redisNamespace({ VERCEL_ENV: "preview", AFFISELL_REDIS_NAMESPACE: bad })).toBe("preview")
    })
  })
})

// ---------------------------------------------------------------------------------------------------------------------------------
// Inventory: every place that talks to Redis goes through the namespace. A NEW Redis user that forgets it makes this fail.
// ---------------------------------------------------------------------------------------------------------------------------------

const root = process.cwd()

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === "__tests__" || entry.startsWith(".")) continue
    const path = join(dir, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) sourceFiles(path, out)
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(path)
  }
  return out
}

const files = ["lib", "app", "workers", "inngest"].flatMap((dir) => sourceFiles(join(root, dir)))
const read = (file: string) => readFileSync(file, "utf8")
const rel = (file: string) => relative(root, file)

describe("redis namespace — inventory of Redis users", () => {
  it("every BullMQ Queue / Worker is built with the environment's prefix", () => {
    const offenders: string[] = []
    for (const file of files) {
      const source = read(file)
      // a worker's processor can be long, so no "within N characters" window: per file, as many `prefix: bullmqPrefix()` as constructors
      const constructors = [...source.matchAll(/new (?:Queue|Worker|QueueEvents|FlowProducer)(?:<[^>]*>)?\(/g)].length
      const prefixed = [...source.matchAll(/prefix:\s*bullmqPrefix\(\)/g)].length
      if (constructors > prefixed) offenders.push(`${rel(file)}: ${constructors} constructors, ${prefixed} prefixed`)
    }
    expect(offenders).toEqual([])
    // and the inventory itself is not empty (the scan would otherwise pass vacuously)
    const constructors = files.reduce((n, f) => n + [...read(f).matchAll(/new (?:Queue|Worker)(?:<[^>]*>)?\(/g)].length, 0)
    expect(constructors).toBe(9)
  })

  it("every file that builds an Upstash / ioredis client and stores keys goes through redisKey()", () => {
    // files that only hand out a connection (no key of their own) are listed with the reason
    const connectionOnly = new Set([
      "lib/auto-order/redis.ts", // the ioredis connection factory: keys belong to its callers
      "lib/radar/redis.ts", // accessor over the same connection
    ])
    const usesRedis =
      /@upstash\/redis|@upstash\/ratelimit|new IORedis\(|getRedisConnection\(|tryGetRedisClient\(|tryGetRedisConnection\(/
    const offenders = files
      .filter((file) => usesRedis.test(read(file)))
      .map(rel)
      .filter((file) => !connectionOnly.has(file))
      // the queue files take their namespace from bullmqPrefix(), which is checked above
      .filter((file) => !/(?:^|\/)(?:place-order\.queue|auto-buy\.queue|order-paid-queue|bull-board-server|place-order\.processor)\.ts$/.test(file))
      .filter((file) => !/\bredisKey\(|\bshieldLogsRedisKey\(/.test(read(join(root, file))))
    expect(offenders).toEqual([])
  })

  it("no literal Redis key escapes the namespace in the files that own them (shield logs, bans, OAuth state, quotas, locks)", () => {
    // a key written as a string literal / a template that does not start with an interpolation (`${…}` is a computed, namespaced key)
    const literalArg = "\\(\\s*(?:[\"']|`(?!\\$\\{))"
    const literal = [
      ["lib/security/humanoid-shield.ts", new RegExp(`redis\\.(?:get|set|del|lpush|ltrim|keys)${literalArg}`)],
      ["app/api/security/logs/route.ts", new RegExp(`redis\\.(?:lrange|lpush|ltrim)${literalArg}`)],
      ["lib/radar/cron-lock.ts", /redis\.(?:set|del)\(\s*key\b/],
      ["lib/fulfillment/rate-limit.ts", /redis\.(?:set|pttl)\(\s*KEY_NAME\b/],
    ] as const
    for (const [file, pattern] of literal) expect(read(join(root, file)), file).not.toMatch(pattern)
  })

  it("each Redis user keeps AT LEAST as many namespaced key constructions as today (a ratchet: dropping one `redisKey(` fails here)", () => {
    // file → number of `redisKey(` calls in its code (`shieldLogsRedisKey(` for the logs route) (comments excluded). Raise it when you add a key; never lower it.
    const pinned: Array<[string, number]> = [
      ["lib/security/humanoid-shield.ts", 3], // ban key, logs key, ban-key glob prefix
      ["app/api/security/logs/route.ts", 3], // lrange / lpush / ltrim on the shield logs list
      ["lib/api-rate-limit.ts", 1],
      ["lib/fulfillment/rate-limit.ts", 1],
      ["lib/growth/winners-quota.server.ts", 1],
      ["lib/radar/oauth-state.ts", 1],
      ["lib/radar/connectors/tiktok-shop.ts", 1],
      ["lib/radar/scan-rate-limit.ts", 1],
      ["lib/radar/cron-lock.ts", 2], // acquire, release
      ["lib/taxonomy-classify.server.ts", 2], // cache key, hourly cap key
      ["lib/title-translation.server.ts", 3], // title key, cooldown, daily counter
      ["lib/ai/market-intelligence-cache.ts", 1],
      ["lib/ai/product-analysis-cache.ts", 1],
      ["lib/ai/smart-margin-analysis-cache.ts", 1],
      ["lib/ai/product-embeddings.ts", 1],
      ["lib/try-on/rate-limit.ts", 2], // per-minute and per-day limiters
      ["lib/try-on/cloth2body-api.server.ts", 1], // per-IP limiter
    ]
    const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "")
    for (const [file, minimum] of pinned) {
      // the logs route builds its key through `shieldLogsRedisKey()` (defined in humanoid-shield, itself pinned above); everywhere else it is `redisKey(`
      const call = file === "app/api/security/logs/route.ts" ? /\bshieldLogsRedisKey\(/g : /\bredisKey\(/g
      expect([...strip(read(join(root, file))).matchAll(call)].length, file).toBeGreaterThanOrEqual(minimum)
    }
  })

  it("the exported cache-key builders really carry the namespace (behaviour, not text)", async () => {
    const { vi } = await import("vitest")
    try {
      vi.stubEnv("VERCEL_ENV", "preview")
      vi.resetModules()
      const title = await import("@/lib/title-translation.server")
      const embed = await import("@/lib/ai/product-embeddings")
      const market = await import("@/lib/ai/market-intelligence-cache")
      const analysis = await import("@/lib/ai/product-analysis-cache")
      const margin = await import("@/lib/ai/smart-margin-analysis-cache")
      const taxo = await import("@/lib/taxonomy-classify.server")
      const keys = [
        title.titleCacheKey("a title", "fr"),
        embed.productImageEmbedKey("url:x"),
        market.marketRedisKey("p"),
        analysis.productAnalysisCacheKey("fp"),
        margin.marginAnalysisCacheKey("p", "u", 10),
        taxo.classificationCacheKey("a title", null),
      ]
      for (const key of keys) expect(key.startsWith("preview:"), key).toBe(true)

      vi.stubEnv("VERCEL_ENV", "production")
      vi.resetModules()
      const prodTitle = await import("@/lib/title-translation.server")
      expect(prodTitle.titleCacheKey("a title", "fr").startsWith("affisell:title-tr:v1:fr:")).toBe(true) // unchanged in production
    } finally {
      vi.unstubAllEnvs()
      vi.resetModules()
    }
  })

  it("the production-key-preserving property: the unprefixed production key of each user is what the code builds when VERCEL_ENV=production", () => {
    const env = { VERCEL_ENV: "production", NODE_ENV: "production" }
    // The key shapes below are the ones production Redis holds today; the namespace must not touch them.
    for (const key of [
      "affisell:shield:ban:1.2.3.4",
      "affisell:shield:logs",
      "affisell:auto-buy:last-run",
      "radar:oauth:state:abc.user",
      "radar:scan:rate:1.2.3.4",
      "growth:winners-quota:user:u1",
      "rl:rl:user:u1",
      "tryon:min",
      "product:embed:deadbeef",
    ]) {
      expect(redisKey(key, env)).toBe(key)
    }
  })
})
