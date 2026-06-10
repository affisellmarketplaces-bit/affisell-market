import { createHash } from "node:crypto"

/** China buying agent ids — mirrors lib/agents.js (client-safe catalog). */
export const CHINA_BUYING_AGENT_IDS = [
  "superbuy",
  "anovabuy",
  "oopbuy",
  "litbuy",
  "cssbuy",
  "sugargoo",
] as const

export type ChinaBuyingAgentId = (typeof CHINA_BUYING_AGENT_IDS)[number]

export const CHINA_PLATFORMS = [
  "1688",
  "Taobao",
  "Tmall",
  "JD.com",
  "Weidian",
  "Pinduoduo",
  "Xianyu",
  "Usines",
] as const

export type ChinaPlatform = (typeof CHINA_PLATFORMS)[number]

export function isChinaBuyingAgentId(id: string): id is ChinaBuyingAgentId {
  return (CHINA_BUYING_AGENT_IDS as readonly string[]).includes(id)
}

export function normalizeChinaPlatform(raw: string | null | undefined): ChinaPlatform | null {
  if (!raw?.trim()) return null
  const hit = CHINA_PLATFORMS.find((p) => p.toLowerCase() === raw.trim().toLowerCase())
  return hit ?? null
}

export function chinaBuyIdempotencyKey(args: {
  supplierId: string
  sourceUrl: string
  agentId: string
}): string {
  const url = args.sourceUrl.trim().toLowerCase()
  const hash = createHash("sha256")
    .update(`${args.supplierId}:${url}:${args.agentId}`)
    .digest("hex")
    .slice(0, 24)
  return `china-buy:${hash}`
}

export function parseChinaImportFields(body: Record<string, unknown>): {
  sourceUrl: string | null
  chinaBuyingAgentId: string | null
  chinaPlatform: string | null
  importSource: string | null
} {
  const sourceUrlRaw = body.sourceUrl
  const sourceUrl =
    typeof sourceUrlRaw === "string" && /^https?:\/\//i.test(sourceUrlRaw.trim())
      ? sourceUrlRaw.trim()
      : null

  const agentRaw = body.chinaBuyingAgentId
  const chinaBuyingAgentId =
    typeof agentRaw === "string" && isChinaBuyingAgentId(agentRaw) ? agentRaw : null

  const platformRaw = body.chinaPlatform
  const chinaPlatform =
    typeof platformRaw === "string" && platformRaw.trim()
      ? normalizeChinaPlatform(platformRaw) ?? platformRaw.trim().slice(0, 32)
      : null

  const importRaw = body.importSource
  let importSource =
    typeof importRaw === "string" && importRaw.trim() ? importRaw.trim().slice(0, 32) : null
  if (!importSource && chinaPlatform) {
    importSource = chinaPlatform.toLowerCase() === "usines" ? "china_factory" : chinaPlatform
  }
  if (!importSource && sourceUrl) {
    if (/1688\.com/i.test(sourceUrl)) importSource = "1688"
    else if (/taobao\.com/i.test(sourceUrl)) importSource = "taobao"
    else if (/tmall\.com/i.test(sourceUrl)) importSource = "tmall"
  }

  return { sourceUrl, chinaBuyingAgentId, chinaPlatform, importSource }
}
