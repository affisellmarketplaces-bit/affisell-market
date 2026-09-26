import { after, NextResponse } from "next/server"

import { aiKeyBearerFromRequest, resolveAiConnectionKey } from "@/lib/ai-connect/keys"
import { handleMcpMessage, type JsonRpcResponse } from "@/lib/ai-connect/mcp"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_BODY_BYTES = 64_000
const MAX_BATCH = 20

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, mcp-protocol-version, mcp-session-id",
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { ...CORS, "Cache-Control": "no-store" } })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

/** Stateless MCP over HTTP: streaming/SSE is not offered, so GET is not allowed. */
export async function GET() {
  return json({ error: "Use POST with a JSON-RPC body (MCP Streamable HTTP)." }, 405)
}

export async function POST(req: Request) {
  const bearer = aiKeyBearerFromRequest(req)
  const principal = bearer ? await resolveAiConnectionKey(bearer) : null
  if (!principal) {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Missing or invalid Affisell AI key" } },
      { status: 401, headers: { ...CORS, "WWW-Authenticate": 'Bearer realm="affisell-mcp"' } }
    )
  }

  const raw = await req.text()
  if (raw.length > MAX_BODY_BYTES) {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Request too large" } }, 413)
  }
  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400)
  }

  const deps = { schedule: (task: () => Promise<void>) => after(task) }
  const messages = Array.isArray(payload) ? payload.slice(0, MAX_BATCH) : [payload]
  const replies: JsonRpcResponse[] = []
  for (const m of messages) {
    const r = await handleMcpMessage((m ?? {}) as Record<string, unknown>, principal, deps)
    if (r) replies.push(r)
  }

  if (replies.length === 0) return new NextResponse(null, { status: 202, headers: CORS })
  return json(Array.isArray(payload) ? replies : replies[0])
}
