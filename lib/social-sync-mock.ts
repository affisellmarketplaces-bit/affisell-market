import type { FollowersJson } from "@/lib/format-followers"

/** Apply ~+5% random drift to each platform count (mock sync). */
export function bumpFollowersMock(prev: FollowersJson): FollowersJson {
  const drift = () => 1 + (Math.random() * 0.1 - 0.02) // roughly +0%..+8%, slight down possible
  const bump = (n: number | undefined) =>
    n == null || !Number.isFinite(n) ? undefined : Math.max(0, Math.round(n * drift()))

  return {
    instagram: bump(prev.instagram ?? 10_000),
    tiktok: bump(prev.tiktok ?? 20_000),
    youtube: bump(prev.youtube ?? 5000),
    twitch: bump(prev.twitch ?? 1200),
    twitter: bump(prev.twitter ?? 3000),
  }
}

export function defaultFollowersMock(): FollowersJson {
  return {
    instagram: 12_500,
    tiktok: 34_000,
    youtube: 5600,
    twitch: 890,
    twitter: 2100,
  }
}

/** Mock live detection: ~30% chance live on twitch or youtube if username set. */
export function mockLiveStatus(opts: {
  twitch?: string | null
  youtube?: string | null
}): { isLive: boolean; livePlatform: string | null; liveUrl: string | null } {
  const roll = Math.random()
  if (roll > 0.7 && opts.twitch?.trim()) {
    return {
      isLive: true,
      livePlatform: "twitch",
      liveUrl: `https://www.twitch.tv/${encodeURIComponent(opts.twitch.replace(/^@/, ""))}`,
    }
  }
  if (roll > 0.85 && opts.youtube?.trim()) {
    const ch = opts.youtube.replace(/^@/, "").trim()
    return {
      isLive: true,
      livePlatform: "youtube",
      liveUrl: `https://www.youtube.com/${ch.startsWith("channel") ? ch : `@${ch}`}`,
    }
  }
  return { isLive: false, livePlatform: null, liveUrl: null }
}
