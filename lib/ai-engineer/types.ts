export type IngTaskType = "BUG" | "FEATURE" | "OPTIMIZATION"

export type IngTaskId =
  | "prisma_engine_empty"
  | "manual_required_flood"
  | "auto_buy_async_failed"
  | "email_failed_spike"
  | "fulfillment_pooler_misconfig"

export interface IngTask {
  id: IngTaskId
  type: IngTaskType
  description: string
  logs: string[]
  priority: number
  /** Optional metric for UI */
  count?: number
  autoFixable?: boolean
}

export interface IngAction {
  file: string
  change: string
  reason: string
  test: string
}

export type IngShipResult = {
  commit: string | null
  push: boolean
  tests: { ok: boolean; output: string }
  dryRun: boolean
}

export type IngAnalyzeResult = {
  tasks: IngTask[]
  logLinesScanned: number
  observedAt: string
}

export type IngChatPlan = {
  summary: string
  tasks: IngTask[]
  actions: IngAction[]
  reply: string
}
