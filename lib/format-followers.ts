/** Compact English label e.g. 12500 → "12.5K" */
export function formatFollowers(count: number | null | undefined): string {
  if (count == null || !Number.isFinite(count) || count < 0) return "—"
  if (count < 1000) return String(Math.round(count))
  if (count < 1_000_000) {
    const k = count / 1000
    const s = k >= 100 ? k.toFixed(0) : k >= 10 ? k.toFixed(1) : k.toFixed(1).replace(/\.0$/, "")
    return `${s}K`
  }
  const m = count / 1_000_000
  return `${m >= 10 ? m.toFixed(0) : m.toFixed(1).replace(/\.0$/, "")}M`
}

export type FollowersJson = {
  instagram?: number
  tiktok?: number
  youtube?: number
  twitch?: number
  twitter?: number
}

export function parseFollowersJson(raw: unknown): FollowersJson {
  if (!raw || typeof raw !== "object") return {}
  const o = raw as Record<string, unknown>
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.round(v)) : undefined)
  return {
    instagram: n(o.instagram),
    tiktok: n(o.tiktok),
    youtube: n(o.youtube),
    twitch: n(o.twitch),
    twitter: n(o.twitter),
  }
}
