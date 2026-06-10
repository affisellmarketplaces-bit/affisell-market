/**
 * Candidature Agent Network — validation pure (client-safe).
 */

export const AGENT_CAPABILITY_OPTIONS = [
  { value: "QC_INSPECTION", labelFr: "Contrôle qualité", labelEn: "Quality control" },
  { value: "COMPLIANCE", labelFr: "Conformité (CE, normes)", labelEn: "Compliance" },
  { value: "PHOTO_PROOF", labelFr: "Photo-preuve", labelEn: "Photo proof" },
  { value: "REPACK_EXPRESS", labelFr: "Relais express 24 h", labelEn: "24h express relay" },
] as const

export type AgentCapabilityOption = (typeof AGENT_CAPABILITY_OPTIONS)[number]["value"]

export type AgentApplicationInput = {
  displayName: string
  contactEmail: string
  contactPhone?: string
  country: string
  city: string
  capabilities: AgentCapabilityOption[]
  languages: string[]
  leadTimeHours: number
  applicationNote?: string
}

export type AgentApplicationResult =
  | { ok: true; deduped?: boolean; reapplied?: boolean }
  | { ok: false; error: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ISO2_RE = /^[A-Z]{2}$/

export function normalizeAgentApplication(raw: unknown): AgentApplicationInput | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>

  const displayName = typeof o.displayName === "string" ? o.displayName.trim() : ""
  const contactEmail = typeof o.contactEmail === "string" ? o.contactEmail.trim().toLowerCase() : ""
  const contactPhone =
    typeof o.contactPhone === "string" && o.contactPhone.trim() ? o.contactPhone.trim() : undefined
  const country = typeof o.country === "string" ? o.country.trim().toUpperCase() : ""
  const city = typeof o.city === "string" ? o.city.trim() : ""
  const applicationNote =
    typeof o.applicationNote === "string" && o.applicationNote.trim()
      ? o.applicationNote.trim().slice(0, 4000)
      : undefined

  const capsRaw = Array.isArray(o.capabilities) ? o.capabilities : []
  const allowed = new Set(AGENT_CAPABILITY_OPTIONS.map((c) => c.value))
  const capabilities = [
    ...new Set(
      capsRaw.filter((c): c is AgentCapabilityOption => typeof c === "string" && allowed.has(c as AgentCapabilityOption))
    ),
  ]

  const langsRaw = Array.isArray(o.languages)
    ? o.languages
    : typeof o.languages === "string"
      ? o.languages.split(/[,;]+/)
      : []
  const languages = [
    ...new Set(
      langsRaw
        .map((l) => (typeof l === "string" ? l.trim().toLowerCase() : ""))
        .filter(Boolean)
        .slice(0, 12)
    ),
  ]

  const leadTimeHours =
    typeof o.leadTimeHours === "number" && Number.isFinite(o.leadTimeHours)
      ? Math.round(o.leadTimeHours)
      : typeof o.leadTimeHours === "string"
        ? Math.round(Number(o.leadTimeHours))
        : NaN

  if (displayName.length < 2 || displayName.length > 120) return null
  if (!EMAIL_RE.test(contactEmail)) return null
  if (!ISO2_RE.test(country)) return null
  if (city.length < 2 || city.length > 80) return null
  if (capabilities.length === 0) return null
  if (languages.length === 0) return null
  if (!Number.isFinite(leadTimeHours) || leadTimeHours < 4 || leadTimeHours > 168) return null

  return {
    displayName,
    contactEmail,
    contactPhone,
    country,
    city,
    capabilities,
    languages,
    leadTimeHours,
    applicationNote,
  }
}

export function agentStatusLabelFr(status: string): string {
  switch (status) {
    case "PENDING":
      return "En attente"
    case "ACTIVE":
      return "Actif"
    case "PAUSED":
      return "Pause"
    case "REJECTED":
      return "Refusé"
    default:
      return status
  }
}

export type AdminAgentAction = "activate" | "reject" | "pause" | "resume"

export function resolveAdminAgentAction(
  current: string,
  action: AdminAgentAction
): "PENDING" | "ACTIVE" | "PAUSED" | "REJECTED" | null {
  switch (action) {
    case "activate":
      if (current === "PENDING" || current === "PAUSED") return "ACTIVE"
      if (current === "ACTIVE") return "ACTIVE"
      return null
    case "reject":
      if (current === "PENDING") return "REJECTED"
      return null
    case "pause":
      if (current === "ACTIVE") return "PAUSED"
      if (current === "PAUSED") return "PAUSED"
      return null
    case "resume":
      if (current === "PAUSED") return "ACTIVE"
      if (current === "ACTIVE") return "ACTIVE"
      return null
    default:
      return null
  }
}
