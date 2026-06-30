const LOCAL_HOST_RE = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?$/i

export function isLocalhostHost(host: string | null | undefined): boolean {
  if (!host?.trim()) return false
  const h = host.trim().toLowerCase().replace(/\.$/, "")
  if (LOCAL_HOST_RE.test(h)) return true
  return h.endsWith(".localhost")
}

export function isLocalhostUrl(raw: string | null | undefined): boolean {
  const trimmed = raw?.trim()
  if (!trimmed) return false
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      return isLocalhostHost(new URL(trimmed).hostname)
    } catch {
      return /localhost|127\.0\.0\.1/i.test(trimmed)
    }
  }
  return isLocalhostHost(trimmed.split("/")[0]?.split(":")[0] ?? trimmed)
}
