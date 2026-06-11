import {
  CHINA_BUYING_AGENT_IDS,
  isChinaBuyingAgentId,
  type ChinaBuyingAgentId,
} from "@/lib/china-buying/china-buying-shared"

/** Display names — mirrors lib/agents.js (client-safe). */
export const CHINA_AGENT_LABELS: Record<ChinaBuyingAgentId, string> = {
  superbuy: "Superbuy",
  anovabuy: "Anovabuy",
  oopbuy: "Oopbuy",
  litbuy: "Litbuy",
  cssbuy: "Cssbuy",
  sugargoo: "Sugargoo",
}

const STUB_URL_BUILDERS: Record<ChinaBuyingAgentId, (productUrl: string) => string> = {
  superbuy: (u) =>
    `https://www.superbuy.com/en/page/buy?url=${encodeURIComponent(u)}`,
  anovabuy: (u) => `https://anovabuy.co/buy?url=${encodeURIComponent(u)}`,
  oopbuy: (u) => `https://www.oopbuy.com/product?url=${encodeURIComponent(u)}`,
  cssbuy: (u) => `https://www.cssbuy.com/item?url=${encodeURIComponent(u)}`,
  litbuy: (u) => `https://litbuy.com/buy?url=${encodeURIComponent(u)}`,
  sugargoo: (u) =>
    `https://www.sugargoo.com/index.php?r=buy&url=${encodeURIComponent(u)}`,
}

/** Manual checkout deep-link when no agent API key is configured. */
export function getAgentStubCheckoutUrl(agentId: string, productUrl: string): string | null {
  if (!isChinaBuyingAgentId(agentId)) return null
  const u = productUrl.trim()
  if (!/^https?:\/\//i.test(u)) return null
  return STUB_URL_BUILDERS[agentId](u)
}

export function chinaAgentStubMessage(agentId: string): string {
  const name = isChinaBuyingAgentId(agentId) ? CHINA_AGENT_LABELS[agentId] : agentId
  return `Ouvre ${name} pour finaliser la commande manuellement`
}

export function allChinaBuyingAgentIds(): readonly ChinaBuyingAgentId[] {
  return CHINA_BUYING_AGENT_IDS
}
