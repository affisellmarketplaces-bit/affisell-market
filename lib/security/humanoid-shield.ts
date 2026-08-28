import type { NextRequest } from "next/server"

export type ShieldAction = "ALLOW" | "CHALLENGE" | "BLOCK"

export type ShieldThreatType =
  | "XSS"
  | "SQLI"
  | "LFI"
  | "RCE"
  | "BOT_UA"
  | "HONEYPOT"
  | "RATE_LIMIT"

export type ShieldThreat = {
  type: ShieldThreatType
  severity: number
  payload: string
  pattern: string
}

export type ShieldAnalyzeResult = {
  ip: string
  score: number
  isHuman: boolean
  threats: ShieldThreat[]
  action: ShieldAction
}

type IpHitWindow = {
  count: number
  windowStart: number
}

type PatternRule = {
  type: ShieldThreatType
  severity: number
  pattern: RegExp
  label: string
}

const WINDOW_MS = 60_000
const NORMAL_LIMIT = 100
const ADMIN_LIMIT = 20
const BLOCK_MS_NORMAL = 2 * 60_000
const BLOCK_MS_ADMIN = 10 * 60_000

const XSS_PATTERNS: PatternRule[] = [
  { type: "XSS", severity: 9, pattern: /<script/i, label: "<script" },
  { type: "XSS", severity: 8, pattern: /javascript:/i, label: "javascript:" },
  { type: "XSS", severity: 8, pattern: /onerror\s*=/i, label: "onerror=" },
  { type: "XSS", severity: 9, pattern: /eval\s*\(/i, label: "eval(" },
  { type: "XSS", severity: 8, pattern: /<iframe/i, label: "<iframe" },
]

const SQLI_PATTERNS: PatternRule[] = [
  { type: "SQLI", severity: 9, pattern: /union\s+select/i, label: "UNION SELECT" },
  { type: "SQLI", severity: 9, pattern: /or\s+1\s*=\s*1/i, label: "OR 1=1" },
  { type: "SQLI", severity: 10, pattern: /drop\s+table/i, label: "DROP TABLE" },
  { type: "SQLI", severity: 7, pattern: /--/, label: "--" },
]

const LFI_PATTERNS: PatternRule[] = [
  { type: "LFI", severity: 9, pattern: /\.\.[\\/]/, label: "../.." },
  { type: "LFI", severity: 10, pattern: /\/etc\/passwd/i, label: "/etc/passwd" },
  { type: "LFI", severity: 10, pattern: /php:\/\//i, label: "php://" },
]

const RCE_PATTERNS: PatternRule[] = [
  { type: "RCE", severity: 10, pattern: /cat\s+\|/i, label: "cat |" },
  { type: "RCE", severity: 10, pattern: /`[^`]+`/, label: "`...`" },
  { type: "RCE", severity: 10, pattern: /\$\([^)]+\)/, label: "$(...)" },
]

const ALL_PATTERNS = [...XSS_PATTERNS, ...SQLI_PATTERNS, ...LFI_PATTERNS, ...RCE_PATTERNS]

const BOT_UA_RE =
  /curl|wget|python-requests|python\/|go-http-client|headless|puppeteer|selenium|scrapy|httpclient|libwww/i

let redisClient: Awaited<ReturnType<typeof loadRedisClient>> | null = null
let redisInitAttempted = false

async function loadRedisClient() {
  const { Redis } = await import("@upstash/redis")
  return Redis.fromEnv()
}

async function getRedis() {
  if (redisInitAttempted) return redisClient
  redisInitAttempted = true
  if (!process.env.UPSTASH_REDIS_REST_URL?.trim()) return null
  try {
    redisClient = await loadRedisClient()
    return redisClient
  } catch (err) {
    console.warn("[shield]", {
      step: "redis_init_skipped",
      message: err instanceof Error ? err.message : "unknown",
    })
    return null
  }
}

function redisBanKey(ip: string): string {
  return `affisell:shield:ban:${ip}`
}

export class HumanoidShield {
  static WHITELIST_IPS = ["127.0.0.1", "::1", "::ffff:127.0.0.1", "10.182.247.98"]

  static SUSPICIOUS_PATHS = [
    "/api/admin/bypass",
    "/.env",
    "/wp-admin",
    "/phpmyadmin",
    "/.git",
    "/admin.php",
    "/actuator",
    "/console",
  ]

  private static ipHits = new Map<string, IpHitWindow>()
  private static blockedUntil = new Map<string, number>()

  static extractIp(req: NextRequest): string {
    const forwarded = req.headers.get("x-forwarded-for")
    if (forwarded) {
      const first = forwarded.split(",")[0]?.trim()
      if (first) return first
    }
    const realIp = req.headers.get("x-real-ip")?.trim()
    if (realIp) return realIp
    const cfIp = req.headers.get("cf-connecting-ip")?.trim()
    if (cfIp) return cfIp
    return "127.0.0.1"
  }

  static isWhitelisted(ip: string): boolean {
    return HumanoidShield.WHITELIST_IPS.includes(ip)
  }

  static isAdminSensitivePath(pathname: string): boolean {
    const p = pathname.toLowerCase()
    return (
      p.includes("/dashboard/admin") ||
      p.startsWith("/api/legal") ||
      p.startsWith("/api/supplier")
    )
  }

  private static scanPayload(payload: string, threats: ShieldThreat[]): void {
    const sample = payload.slice(0, 2048)
    for (const rule of ALL_PATTERNS) {
      if (rule.pattern.test(sample)) {
        threats.push({
          type: rule.type,
          severity: rule.severity,
          payload: sample.slice(0, 120),
          pattern: rule.label,
        })
      }
    }
  }

  private static checkBotUa(ua: string, threats: ShieldThreat[]): void {
    if (!ua.trim()) {
      threats.push({
        type: "BOT_UA",
        severity: 7,
        payload: "",
        pattern: "empty UA",
      })
      return
    }
    if (BOT_UA_RE.test(ua)) {
      threats.push({
        type: "BOT_UA",
        severity: 6,
        payload: ua.slice(0, 80),
        pattern: "bot UA signature",
      })
    }
  }

  private static checkHoneypotPath(pathname: string, threats: ShieldThreat[]): void {
    const lower = pathname.toLowerCase()
    for (const trap of HumanoidShield.SUSPICIOUS_PATHS) {
      if (lower === trap || lower.startsWith(`${trap}/`)) {
        threats.push({
          type: "HONEYPOT",
          severity: 10,
          payload: pathname,
          pattern: trap,
        })
        break
      }
    }
  }

  private static trackRateLimit(ip: string, pathname: string, threats: ShieldThreat[]): void {
    const now = Date.now()
    const blocked = HumanoidShield.blockedUntil.get(ip) ?? 0
    if (blocked > now) {
      threats.push({
        type: "RATE_LIMIT",
        severity: 10,
        payload: ip,
        pattern: "blocked_until",
      })
      return
    }

    const limit = HumanoidShield.isAdminSensitivePath(pathname) ? ADMIN_LIMIT : NORMAL_LIMIT
    const hit = HumanoidShield.ipHits.get(ip)
    if (!hit || now - hit.windowStart >= WINDOW_MS) {
      HumanoidShield.ipHits.set(ip, { count: 1, windowStart: now })
      return
    }

    hit.count += 1
    if (hit.count > limit) {
      const blockMs = limit === ADMIN_LIMIT ? BLOCK_MS_ADMIN : BLOCK_MS_NORMAL
      const until = now + blockMs
      HumanoidShield.blockedUntil.set(ip, until)
      void HumanoidShield.persistBan(ip, until)
      threats.push({
        type: "RATE_LIMIT",
        severity: 9,
        payload: `${hit.count}/${limit}`,
        pattern: "rate_exceeded",
      })
    }
  }

  private static async persistBan(ip: string, until: number): Promise<void> {
    const redis = await getRedis()
    if (!redis) return
    const ttlSec = Math.max(1, Math.ceil((until - Date.now()) / 1000))
    try {
      await redis.set(redisBanKey(ip), String(until), { ex: ttlSec })
    } catch (err) {
      console.warn("[shield]", {
        step: "redis_ban_failed",
        ip,
        message: err instanceof Error ? err.message : "unknown",
      })
    }
  }

  private static async hydrateBanFromRedis(ip: string): Promise<void> {
    const local = HumanoidShield.blockedUntil.get(ip)
    if (local && local > Date.now()) return
    const redis = await getRedis()
    if (!redis) return
    try {
      const raw = await redis.get(redisBanKey(ip))
      if (!raw) return
      const until = Number(raw)
      if (Number.isFinite(until) && until > Date.now()) {
        HumanoidShield.blockedUntil.set(ip, until)
      }
    } catch {
      // in-memory fallback
    }
  }

  private static computeScore(threats: ShieldThreat[]): number {
    let score = 100
    for (const t of threats) {
      score -= t.severity * 4
    }
    return Math.max(0, Math.min(100, score))
  }

  private static resolveAction(
    ip: string,
    score: number,
    threats: ShieldThreat[]
  ): ShieldAction {
    const maxSeverity = threats.reduce((m, t) => Math.max(m, t.severity), 0)
    const whitelisted = HumanoidShield.isWhitelisted(ip)
    const forceBlockTypes = new Set<ShieldThreatType>(["HONEYPOT", "LFI", "RCE"])

    if (maxSeverity >= 9) {
      if (whitelisted && !threats.some((t) => forceBlockTypes.has(t.type))) {
        return maxSeverity >= 6 || score < 40 ? "CHALLENGE" : "ALLOW"
      }
      return "BLOCK"
    }
    if (maxSeverity >= 6 || score < 40) return "CHALLENGE"
    return "ALLOW"
  }

  static analyze(req: NextRequest): ShieldAnalyzeResult {
    const ip = HumanoidShield.extractIp(req)
    const pathname = req.nextUrl.pathname
    const ua = req.headers.get("user-agent") ?? ""
    const threats: ShieldThreat[] = []

    void HumanoidShield.hydrateBanFromRedis(ip)

    HumanoidShield.trackRateLimit(ip, pathname, threats)
    HumanoidShield.checkHoneypotPath(pathname, threats)
    HumanoidShield.checkBotUa(ua, threats)

    const scanTarget = `${pathname}${req.nextUrl.search}`
    HumanoidShield.scanPayload(scanTarget, threats)

    const score = HumanoidShield.computeScore(threats)
    const action = HumanoidShield.resolveAction(ip, score, threats)
    const isHuman = action === "ALLOW" && score >= 60 && !threats.some((t) => t.type === "BOT_UA")

    return { ip, score, isHuman, threats, action }
  }

  static log(result: ShieldAnalyzeResult, req: NextRequest): void {
    console.log(
      `[shield] ${JSON.stringify({
        action: result.action,
        ip: result.ip,
        path: req.nextUrl.pathname,
        threats: result.threats.map((t) => t.type),
        score: result.score,
        ua: (req.headers.get("user-agent") ?? "").slice(0, 60),
      })}`
    )
  }
}
