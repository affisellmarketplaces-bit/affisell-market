/**
 * Affisell Agent Network — fonctions pures (client-safe, pas de Prisma).
 *
 * Réseau mondial d'agents locaux vérifiés : contrôle qualité, conformité,
 * photo-preuve et relais express. Le matching classe les agents par
 * capacité requise, proximité (pays d'origine du SKU), note et rapidité.
 */

export type AgentCapabilityValue =
  | "QC_INSPECTION"
  | "COMPLIANCE"
  | "PHOTO_PROOF"
  | "REPACK_EXPRESS"

export type AgentMissionTypeValue =
  | "QC_INSPECTION"
  | "COMPLIANCE_CHECK"
  | "PHOTO_PROOF"
  | "REPACK_EXPRESS"

export type AgentMissionStatusValue =
  | "REQUESTED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "PASSED"
  | "FAILED"
  | "CANCELLED"

export type AgentLite = {
  id: string
  displayName: string
  country: string
  city: string
  capabilities: AgentCapabilityValue[]
  ratingX10: number
  missionsDone: number
  leadTimeHours: number
}

export type MissionTypeDef = {
  type: AgentMissionTypeValue
  /** Capacité agent requise pour ce type de mission. */
  capability: AgentCapabilityValue
  /** Tarif catalogue (bêta : offert, facturé 0). */
  listPriceCents: number
  /** SLA indicatif (heures) affiché côté fournisseur. */
  slaHours: number
}

export const AGENT_MISSION_TYPE_DEFS: readonly MissionTypeDef[] = [
  { type: "QC_INSPECTION", capability: "QC_INSPECTION", listPriceCents: 1900, slaHours: 48 },
  { type: "COMPLIANCE_CHECK", capability: "COMPLIANCE", listPriceCents: 2900, slaHours: 72 },
  { type: "PHOTO_PROOF", capability: "PHOTO_PROOF", listPriceCents: 900, slaHours: 24 },
  { type: "REPACK_EXPRESS", capability: "REPACK_EXPRESS", listPriceCents: 2400, slaHours: 24 },
] as const

export function missionTypeDef(type: AgentMissionTypeValue): MissionTypeDef {
  const def = AGENT_MISSION_TYPE_DEFS.find((d) => d.type === type)
  if (!def) throw new Error(`Unknown mission type: ${type}`)
  return def
}

export function isAgentMissionType(value: unknown): value is AgentMissionTypeValue {
  return AGENT_MISSION_TYPE_DEFS.some((d) => d.type === value)
}

/** Transitions autorisées du workflow mission (idempotence : re-poser le même statut est no-op côté API). */
export const MISSION_STATUS_TRANSITIONS: Record<
  AgentMissionStatusValue,
  readonly AgentMissionStatusValue[]
> = {
  REQUESTED: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["PASSED", "FAILED", "CANCELLED"],
  PASSED: [],
  FAILED: [],
  CANCELLED: [],
}

export function canTransitionMission(
  from: AgentMissionStatusValue,
  to: AgentMissionStatusValue
): boolean {
  return MISSION_STATUS_TRANSITIONS[from]?.includes(to) ?? false
}

/** Supplier may edit brief / fee / urgency before agent starts work. */
export const SUPPLIER_EDITABLE_MISSION_STATUSES: readonly AgentMissionStatusValue[] = [
  "REQUESTED",
  "ASSIGNED",
]

export function canSupplierEditMission(status: AgentMissionStatusValue): boolean {
  return SUPPLIER_EDITABLE_MISSION_STATUSES.includes(status)
}

export function canSupplierCancelMission(status: AgentMissionStatusValue): boolean {
  return canTransitionMission(status, "CANCELLED")
}

/** Terminal missions removable from supplier history. */
export const SUPPLIER_DELETABLE_MISSION_STATUSES: readonly AgentMissionStatusValue[] = [
  "CANCELLED",
  "PASSED",
  "FAILED",
]

export function canSupplierDeleteMission(status: AgentMissionStatusValue): boolean {
  return SUPPLIER_DELETABLE_MISSION_STATUSES.includes(status)
}

export type MatchContext = {
  missionType: AgentMissionTypeValue
  /** Pays d'origine probable du SKU (ISO-2), ex. "CN" pour un import 1688/AE. */
  preferredCountry?: string | null
}

export type MatchedAgent = {
  agent: AgentLite
  /** 0–100, plus haut = meilleur match. */
  score: number
  sameCountry: boolean
}

/**
 * Classe les agents pour une mission : capacité requise (éliminatoire),
 * puis pays (+30), note (0–25), expérience (0–25, log), rapidité (0–20).
 */
export function matchAgentsForMission(
  agents: readonly AgentLite[],
  ctx: MatchContext
): MatchedAgent[] {
  const { capability } = missionTypeDef(ctx.missionType)
  const country = ctx.preferredCountry?.trim().toUpperCase() || null

  return agents
    .filter((agent) => agent.capabilities.includes(capability))
    .map((agent) => {
      const sameCountry = country !== null && agent.country.toUpperCase() === country
      const countryScore = sameCountry ? 30 : 0
      const ratingScore = Math.min(25, Math.max(0, ((agent.ratingX10 - 30) / 20) * 25))
      const expScore = Math.min(25, Math.log10(1 + Math.max(0, agent.missionsDone)) * 10)
      const speedScore = Math.min(20, Math.max(0, ((96 - agent.leadTimeHours) / 96) * 20))
      const score = Math.round(countryScore + ratingScore + expScore + speedScore)
      return { agent, score, sameCountry }
    })
    .sort((a, b) => b.score - a.score || a.agent.leadTimeHours - b.agent.leadTimeHours)
}

/** Devine le pays d'origine d'un SKU à partir de sa source d'import. */
export function guessSkuOriginCountry(input: {
  importSource?: string | null
  sourceUrl?: string | null
}): string | null {
  const source = (input.importSource ?? "").toLowerCase()
  const url = (input.sourceUrl ?? "").toLowerCase()
  if (source === "1688" || url.includes("1688.com")) return "CN"
  if (source === "aliexpress" || url.includes("aliexpress.")) return "CN"
  if (url.includes("alibaba.com")) return "CN"
  return null
}
