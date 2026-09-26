import { z } from "zod"

import { prisma } from "@/lib/prisma"
import { consumeRateLimit } from "@/lib/api-rate-limit"
import { AI_TOOLS, AiToolError, toolsForRole, type AiToolDef } from "@/lib/ai-connect/tools"
import type { AiKeyPrincipal } from "@/lib/ai-connect/keys"

const SUPPORTED_PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"]
const MAX_RESULT_CHARS = 20_000

type JsonRpcId = string | number | null
type JsonRpcRequest = { jsonrpc?: string; id?: JsonRpcId; method?: string; params?: Record<string, unknown> }
export type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: JsonRpcId; result: unknown }
  | { jsonrpc: "2.0"; id: JsonRpcId; error: { code: number; message: string } }

export type McpDeps = {
  /** Runs work after the response is sent (Next.js `after`). */
  schedule: (task: () => Promise<void>) => void
}

const ok = (id: JsonRpcId, result: unknown): JsonRpcResponse => ({ jsonrpc: "2.0", id, result })
const fail = (id: JsonRpcId, code: number, message: string): JsonRpcResponse => ({
  jsonrpc: "2.0",
  id,
  error: { code, message },
})

function textResult(payload: unknown, isError = false) {
  let text = typeof payload === "string" ? payload : JSON.stringify(payload)
  if (text.length > MAX_RESULT_CHARS) text = `${text.slice(0, MAX_RESULT_CHARS)}… [truncated]`
  return { content: [{ type: "text", text }], ...(isError ? { isError: true } : {}) }
}

function publicError(err: unknown): string {
  return err instanceof AiToolError ? err.message : "Internal error while running the tool"
}

function describeTool(t: AiToolDef) {
  return {
    name: t.name,
    description: t.description,
    inputSchema: z.toJSONSchema(t.input, { io: "input", target: "draft-7" }),
  }
}

async function runMission(missionId: string, tool: AiToolDef, principal: AiKeyPrincipal, args: unknown) {
  await prisma.aiMission.update({ where: { id: missionId }, data: { status: "running" } }).catch(() => {})
  try {
    const result = await tool.run({ userId: principal.userId, role: principal.role }, args)
    await prisma.aiMission.update({
      where: { id: missionId },
      data: { status: "done", result: JSON.parse(JSON.stringify(result ?? null)), completedAt: new Date() },
    })
  } catch (err) {
    await prisma.aiMission
      .update({
        where: { id: missionId },
        data: { status: "failed", error: publicError(err), completedAt: new Date() },
      })
      .catch(() => {})
  }
}

async function callTool(
  id: JsonRpcId,
  principal: AiKeyPrincipal,
  params: Record<string, unknown> | undefined,
  deps: McpDeps
): Promise<JsonRpcResponse> {
  const name = typeof params?.name === "string" ? params.name : ""
  const tool = toolsForRole(principal.role).find((t) => t.name === name)
  if (!tool) {
    const exists = AI_TOOLS.some((t) => t.name === name)
    return fail(id, -32602, exists ? `Tool "${name}" is not available for this account role` : `Unknown tool "${name}"`)
  }

  const parsed = tool.input.safeParse(params?.arguments ?? {})
  if (!parsed.success) {
    return ok(id, textResult(`Invalid arguments: ${parsed.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ")}`, true))
  }

  const limit = consumeRateLimit(principal.keyId, {
    prefix: tool.mode === "async" ? "ai-mcp-async" : "ai-mcp",
    limit: tool.mode === "async" ? 10 : 60,
    windowMs: 60_000,
  })
  if (!limit.ok) {
    return ok(id, textResult(`Rate limit reached. Retry in ${limit.retrySec}s.`, true))
  }

  const mission = await prisma.aiMission.create({
    data: {
      userId: principal.userId,
      keyId: principal.keyId,
      tool: tool.name,
      status: tool.mode === "async" ? "queued" : "running",
      input: JSON.parse(JSON.stringify(parsed.data)),
    },
    select: { id: true },
  })

  if (tool.mode === "async") {
    deps.schedule(() => runMission(mission.id, tool, principal, parsed.data))
    return ok(id, textResult({ missionId: mission.id, status: "queued", next: "Call get_mission with this missionId." }))
  }

  try {
    const result = await tool.run({ userId: principal.userId, role: principal.role }, parsed.data)
    await prisma.aiMission
      .update({ where: { id: mission.id }, data: { status: "done", completedAt: new Date() } })
      .catch(() => {})
    return ok(id, textResult(result ?? null))
  } catch (err) {
    await prisma.aiMission
      .update({
        where: { id: mission.id },
        data: { status: "failed", error: publicError(err), completedAt: new Date() },
      })
      .catch(() => {})
    return ok(id, textResult(publicError(err), true))
  }
}

/** Handles one JSON-RPC message of the MCP protocol. Returns null for notifications (no reply). */
export async function handleMcpMessage(
  msg: JsonRpcRequest,
  principal: AiKeyPrincipal,
  deps: McpDeps
): Promise<JsonRpcResponse | null> {
  const id = msg.id ?? null
  const isNotification = msg.id === undefined
  if (msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
    return fail(id, -32600, "Invalid JSON-RPC request")
  }

  switch (msg.method) {
    case "initialize": {
      const asked = typeof msg.params?.protocolVersion === "string" ? msg.params.protocolVersion : ""
      return ok(id, {
        protocolVersion: SUPPORTED_PROTOCOLS.includes(asked) ? asked : SUPPORTED_PROTOCOLS[0],
        capabilities: { tools: {} },
        serverInfo: { name: "affisell", version: "1.0.0" },
        instructions:
          "Affisell MCP. Read your catalog, sales and orders, and preview product imports. The AI can read and prepare drafts only: it cannot publish, change prices, spend or refund money.",
      })
    }
    case "ping":
      return ok(id, {})
    case "tools/list":
      return ok(id, { tools: toolsForRole(principal.role).map(describeTool) })
    case "tools/call":
      return callTool(id, principal, msg.params, deps)
    default:
      if (isNotification || msg.method.startsWith("notifications/")) return null
      return fail(id, -32601, `Method not found: ${msg.method}`)
  }
}
