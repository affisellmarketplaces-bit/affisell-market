/** IP client (proxy-aware) — preuve acceptation CGU / conditions. */
export function clientIpFromRequest(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")
  const first = forwarded?.split(",")[0]?.trim()
  return first || req.headers.get("x-real-ip")?.trim() || "unknown"
}

export function userAgentFromRequest(req: Request): string {
  return req.headers.get("user-agent")?.trim().slice(0, 512) || "unknown"
}
