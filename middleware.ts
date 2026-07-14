import type { NextRequest } from "next/server"

import { marketIntelliDisabledResponse } from "@/lib/market-intelli/gate"
import { config as proxyConfig, proxy } from "./proxy"

export async function middleware(req: NextRequest) {
  const blocked = marketIntelliDisabledResponse(req)
  if (blocked) return blocked
  return proxy(req)
}

export const config = {
  ...proxyConfig,
  matcher: [
    ...(Array.isArray(proxyConfig.matcher) ? proxyConfig.matcher : [proxyConfig.matcher]),
    "/intelli",
    "/intelli/:path*",
    "/api/intelli/:path*",
  ],
}
