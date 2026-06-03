export type SentinelSeverity = "P0" | "P1" | "P2" | "P3"

export type SentinelDomain =
  | "stripe"
  | "fulfillment"
  | "webhook"
  | "catalog"
  | "platform"
  | "providers"

export type SentinelPlaybook =
  | "open-stripe-health"
  | "open-auto-fulfill"
  | "open-order"
  | "open-providers"
  | "run-discovery-bootstrap"

export type SentinelSignalInput = {
  severity: SentinelSeverity
  domain: SentinelDomain
  code: string
  title: string
  detail: string
  metric?: number
  entityType?: string
  entityId?: string
  playbook?: SentinelPlaybook
}

export type SentinelSignalRow = SentinelSignalInput & {
  id: string
  detectedAt: string
  resolvedAt: string | null
  lastSeenAt: string
}

export type SentinelDomainCounts = Record<SentinelDomain, { open: number; p0: number }>

export type SentinelDashboard = {
  score: number
  scannedAt: string
  openCounts: Record<SentinelSeverity, number>
  domainCounts: SentinelDomainCounts
  signals: SentinelSignalRow[]
}
