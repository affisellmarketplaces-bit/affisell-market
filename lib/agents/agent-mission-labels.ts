import type { AgentMissionTypeValue } from "@/lib/agents/agent-network-shared"

export const MISSION_TYPE_LABELS_FR: Record<AgentMissionTypeValue, string> = {
  QC_INSPECTION: "Contrôle qualité",
  COMPLIANCE_CHECK: "Conformité",
  PHOTO_PROOF: "Photo-preuve",
  REPACK_EXPRESS: "Relais express",
}
