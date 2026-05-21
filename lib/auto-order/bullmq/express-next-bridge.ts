import { EventEmitter } from "node:events"

import type { Application, RequestHandler } from "express"
import { createRequest, createResponse } from "node-mocks-http"
import type { NextRequest } from "next/server"

/**
 * Run an Express app/router against a Next.js App Router Request (Node runtime).
 */
export async function runExpressOnNextRequest(
  app: Application | RequestHandler,
  req: NextRequest
): Promise<Response> {
  const url = new URL(req.url)
  const body =
    req.method !== "GET" && req.method !== "HEAD" ? Buffer.from(await req.arrayBuffer()) : undefined

  const mockReq = createRequest({
    method: req.method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS",
    url: url.pathname + url.search,
    headers: Object.fromEntries(req.headers.entries()),
    body,
  })

  const mockRes = createResponse({ eventEmitter: EventEmitter })

  await new Promise<void>((resolve, reject) => {
    mockRes.on("finish", () => resolve())
    mockRes.on("error", reject)
    const handler = typeof app === "function" && "use" in app ? (app as Application) : null
    if (handler) {
      handler(mockReq, mockRes, (err: unknown) => (err ? reject(err) : undefined))
    } else {
      ;(app as RequestHandler)(mockReq, mockRes, (err: unknown) => (err ? reject(err) : undefined))
    }
  })

  const headers = new Headers()
  const rawHeaders = mockRes.getHeaders()
  for (const [key, value] of Object.entries(rawHeaders)) {
    if (value == null) continue
    headers.set(key, Array.isArray(value) ? value.map(String).join(", ") : String(value))
  }

  const data = mockRes._getBuffer?.() ?? mockRes._getData?.()
  let bodyOut: BodyInit | null = null
  if (Buffer.isBuffer(data)) {
    bodyOut = new Uint8Array(data)
  } else if (data != null) {
    bodyOut = String(data)
  }

  return new Response(bodyOut, { status: mockRes.statusCode, headers })
}
