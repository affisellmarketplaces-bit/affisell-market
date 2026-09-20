import "server-only"

import { createHash } from "node:crypto"

import { AnthropicError, anthropicChatText, hasAnthropicApiKey } from "@/lib/ai/anthropic-client"
import type { AppLocale } from "@/lib/i18n-locale"

/**
 * Buyer-language product titles. A title written in another language (very common with imported supplier feeds)
 * reads like a copied listing; here it is translated ONCE per (title, language) and cached.
 *
 *  - Render path is cache-only: `translateTitles()` never waits for the model. Misses are translated in the
 *    background (`after`) and served from the next request on.
 *  - The model is told to keep brands, models, numbers and units; a translation that loses any digit-bearing
 *    token is rejected and the original title is kept.
 *  - Bounded cost: batches of 20, max 24 new titles per request, a daily cap, and a cool-down after a failure.
 *  - Storage: Upstash Redis (no schema, no migration). Without Redis or a model key everything is a no-op.
 */

const KEY_PREFIX = "affisell:title-tr:v1"
const TTL_SECONDS = 60 * 60 * 24 * 90
const BATCH = 20
const MAX_NEW_PER_REQUEST = 24
const DAILY_CAP = 2000
const COOLDOWN_SECONDS = 90

export const LANGUAGE_NAME: Record<AppLocale, string> = {
  en: "English",
  fr: "French",
  de: "German",
  es: "Spanish",
  it: "Italian",
  nl: "Dutch",
  pl: "Polish",
  zh: "Simplified Chinese",
}

type RedisLike = {
  mget: (...keys: string[]) => Promise<(string | null)[]>
  set: (key: string, value: string, opts?: { ex?: number; nx?: boolean }) => Promise<unknown>
  incr: (key: string) => Promise<number>
  expire: (key: string, seconds: number) => Promise<unknown>
  get: (key: string) => Promise<string | null>
}

let redisPromise: Promise<RedisLike | null> | null = null
export function __setRedisForTests(client: RedisLike | null): void {
  redisPromise = Promise.resolve(client)
}

async function getRedis(): Promise<RedisLike | null> {
  redisPromise ??= (async () => {
    if (!process.env.UPSTASH_REDIS_REST_URL?.trim()) return null
    try {
      const { Redis } = await import("@upstash/redis")
      return Redis.fromEnv() as unknown as RedisLike
    } catch {
      return null
    }
  })()
  return redisPromise
}

const norm = (t: string) => t.replace(/\s+/g, " ").trim()
export function titleCacheKey(title: string, locale: AppLocale): string {
  return `${KEY_PREFIX}:${locale}:${createHash("sha1").update(norm(title)).digest("hex").slice(0, 20)}`
}

/** Tokens that carry hard facts (any digit: models, sizes, quantities) must survive translation verbatim. */
export function factTokens(s: string): string[] {
  return (s.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}.,/_-]*/gu) ?? []).filter((t) => /\d/.test(t))
}

export function isFaithful(source: string, translated: string): boolean {
  const t = translated.toLowerCase()
  return factTokens(source).every((tok) => t.includes(tok.replace(/[.,]+$/, "")))
}

function parseTranslations(raw: string, expected: number): string[] | null {
  const m = /\[[\s\S]*\]/.exec(raw)
  if (!m) return null
  try {
    const arr = JSON.parse(m[0]) as unknown
    if (!Array.isArray(arr) || arr.length !== expected) return null
    return arr.map((x) => (typeof x === "string" ? norm(x) : ""))
  } catch {
    return null
  }
}

async function callModel(titles: string[], locale: AppLocale): Promise<string[] | null> {
  if (!hasAnthropicApiKey()) return null
  const language = LANGUAGE_NAME[locale]
  try {
    const raw = await anthropicChatText({
      system:
        `You translate e-commerce product titles into ${language} for a European marketplace. Rules: ` +
        `keep brand names, model names/numbers, sizes, units and every digit exactly as written; ` +
        `never add marketing words, claims or punctuation decoration; keep each title concise (max 80 characters); ` +
        `if a title is already in ${language}, return it unchanged. ` +
        `Output ONLY a JSON array of strings, same length and same order as the input.`,
      user: JSON.stringify(titles),
      maxTokens: 1800,
      temperature: 0,
      timeoutMs: 25_000,
    })
    return parseTranslations(raw, titles.length)
  } catch (error) {
    console.warn("[title-translation]", error instanceof AnthropicError ? error.message : String(error))
    return null
  }
}

/** Translate + store. Safe to call in the background; returns how many titles were stored. */
export async function translateAndStoreTitles(titles: string[], locale: AppLocale): Promise<number> {
  const redis = await getRedis()
  if (!redis || !hasAnthropicApiKey() || titles.length === 0) return 0
  const unique = [...new Set(titles.map(norm).filter(Boolean))].slice(0, MAX_NEW_PER_REQUEST)

  const cooldownKey = `${KEY_PREFIX}:cooldown`
  if (await redis.get(cooldownKey).catch(() => null)) return 0
  const day = new Date().toISOString().slice(0, 10)
  const counterKey = `${KEY_PREFIX}:count:${day}`
  const used = await redis.incr(counterKey).catch(() => 0)
  if (used === 1) await redis.expire(counterKey, 60 * 60 * 26).catch(() => undefined)
  if (used > DAILY_CAP) return 0

  let stored = 0
  for (let i = 0; i < unique.length; i += BATCH) {
    const chunk = unique.slice(i, i + BATCH)
    const out = await callModel(chunk, locale)
    if (!out) {
      await redis.set(cooldownKey, "1", { ex: COOLDOWN_SECONDS }).catch(() => undefined)
      break
    }
    await Promise.all(
      chunk.map((src, idx) => {
        const candidate = out[idx] ?? ""
        // Unfaithful / empty / absurd output ⇒ remember the ORIGINAL so we do not pay to retry it for 90 days.
        const value = candidate && candidate.length <= 140 && isFaithful(src, candidate) ? candidate : src
        stored++
        return redis.set(titleCacheKey(src, locale), value, { ex: TTL_SECONDS }).catch(() => undefined)
      })
    )
  }
  return stored
}

async function schedule(work: () => Promise<unknown>): Promise<void> {
  try {
    const { after } = await import("next/server")
    after(work)
  } catch {
    void work().catch(() => undefined)
  }
}

/**
 * Titles in the buyer's language, aligned with the input. Cache-only on the render path: a miss keeps the original
 * for THIS request and is translated in the background for the next one. Never throws, never blocks.
 */
export async function translateTitles(titles: readonly string[], locale: AppLocale): Promise<string[]> {
  if (titles.length === 0) return []
  const redis = await getRedis()
  if (!redis || !hasAnthropicApiKey()) return [...titles]

  const cleaned = titles.map(norm)
  const unique = [...new Set(cleaned.filter(Boolean))]
  let cached: (string | null)[] = []
  try {
    cached = await redis.mget(...unique.map((t) => titleCacheKey(t, locale)))
  } catch {
    return [...titles]
  }
  const byTitle = new Map<string, string>()
  const missing: string[] = []
  unique.forEach((t, i) => {
    const hit = cached[i]
    if (typeof hit === "string" && hit.length > 0) byTitle.set(t, hit)
    else missing.push(t)
  })
  if (missing.length > 0) void schedule(() => translateAndStoreTitles(missing, locale))
  return titles.map((t, i) => byTitle.get(cleaned[i]!) ?? t)
}
