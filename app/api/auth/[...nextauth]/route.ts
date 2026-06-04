import * as Sentry from "@sentry/nextjs"
import type { NextRequest } from "next/server"

import { handlers } from "@/auth"
import {
  clientIpFromRequest,
  errorMessage,
  errorStackSnippet,
  flushLogs,
  logger,
} from "@/lib/logger"

const ROUTE = "auth/nextauth"

type AuthHandler = (req: NextRequest) => Promise<Response>

function withLogtail(handler: AuthHandler, method: string): AuthHandler {
  return async (req: NextRequest) => {
    const ip = clientIpFromRequest(req)
    const path = new URL(req.url).pathname
    try {
      await logger.info("NextAuth request", { route: ROUTE, method, path, ip })
      const res = await handler(req)
      await logger.info("NextAuth response", {
        route: ROUTE,
        method,
        path,
        status: res.status,
      })
      return res
    } catch (e) {
      Sentry.captureException(e)
      await logger.error("NextAuth failed", {
        route: ROUTE,
        method,
        path,
        ip,
        error: errorMessage(e),
        stack: errorStackSnippet(e),
      })
      throw e
    } finally {
      await flushLogs()
    }
  }
}

export const GET = withLogtail(handlers.GET, "GET")
export const POST = withLogtail(handlers.POST, "POST")
