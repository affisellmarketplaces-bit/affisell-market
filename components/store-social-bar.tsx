"use client"

import { MessageCircle, MonitorPlay, Music, Radio, Share2, Tv, UserPlus, Users } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useState } from "react"

import { PUBLIC_SHOPS_PATH } from "@/lib/affiliate-routes"
import { shopBuyerLoginPath } from "@/lib/login-redirect"
import { formatFollowers, type FollowersJson } from "@/lib/format-followers"

function cleanHandle(h: string | null | undefined) {
  if (!h) return ""
  return h.trim().replace(/^@+/, "")
}

function igUrl(h: string) {
  return `https://www.instagram.com/${encodeURIComponent(h)}/`
}
function ttUrl(h: string) {
  return `https://www.tiktok.com/@${encodeURIComponent(h)}`
}
function ytUrl(h: string) {
  const t = h.trim()
  if (t.startsWith("UC") && t.length > 10)
    return `https://www.youtube.com/channel/${encodeURIComponent(t)}`
  return `https://www.youtube.com/@${encodeURIComponent(t.replace(/^@/, ""))}`
}
function twitchUrl(h: string) {
  return `https://www.twitch.tv/${encodeURIComponent(h.replace(/^@/, ""))}`
}

type Props = {
  storeSlug: string
  instagram: string | null
  tiktok: string | null
  youtube: string | null
  twitch: string | null
  followers: FollowersJson
  isLive: boolean
  liveUrl: string | null
  /** DB follower count */
  followCount: number
  initialFollowing: boolean
  viewerLoggedIn: boolean
}

export function StoreSocialBar(props: Props) {
  const {
    storeSlug,
    instagram,
    tiktok,
    youtube,
    twitch,
    followers,
    isLive,
    liveUrl,
    followCount,
    initialFollowing,
    viewerLoggedIn,
  } = props

  const router = useRouter()
  const [following, setFollowing] = useState(initialFollowing)
  const [count, setCount] = useState(followCount)
  const [busy, setBusy] = useState(false)

  const ig = cleanHandle(instagram)
  const tt = cleanHandle(tiktok)
  const yt = cleanHandle(youtube)
  const tc = cleanHandle(twitch)

  const toggleFollow = useCallback(async () => {
    if (!viewerLoggedIn) {
      router.push(shopBuyerLoginPath(storeSlug))
      return
    }
    setBusy(true)
    try {
      const res = await fetch("/api/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ storeSlug }),
      })
      const j = (await res.json()) as { following?: boolean; followCount?: number; error?: string }
      if (!res.ok) throw new Error(j.error ?? "Could not update follow")
      if (typeof j.following === "boolean") setFollowing(j.following)
      if (typeof j.followCount === "number") setCount(j.followCount)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }, [viewerLoggedIn, router, storeSlug])

  function onMessage() {
    if (!viewerLoggedIn) {
      router.push(shopBuyerLoginPath(storeSlug))
      return
    }
    const el = document.getElementById("community")
    el?.scrollIntoView({ behavior: "smooth" })
  }

  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      {isLive && liveUrl ? (
        <a
          href={liveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex animate-pulse items-center gap-1 rounded-full bg-red-600 px-3 py-1 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
        >
          <Radio className="h-3 w-3 shrink-0" aria-hidden /> LIVE NOW
        </a>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {ig ? (
          <a
            href={igUrl(ig)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-800 ring-1 ring-zinc-200 hover:bg-white dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-600"
          >
            <Share2 className="h-3.5 w-3.5" aria-hidden /> {formatFollowers(followers.instagram)}
          </a>
        ) : null}
        {tt ? (
          <a
            href={ttUrl(tt)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-800 ring-1 ring-zinc-200 hover:bg-white dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-600"
          >
            <Music className="h-3.5 w-3.5" aria-hidden /> {formatFollowers(followers.tiktok)}
          </a>
        ) : null}
        {yt ? (
          <a
            href={ytUrl(yt)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-800 ring-1 ring-zinc-200 hover:bg-white dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-600"
          >
            <Tv className="h-3.5 w-3.5" aria-hidden /> {formatFollowers(followers.youtube)}
          </a>
        ) : null}
        {tc ? (
          <a
            href={twitchUrl(tc)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-800 ring-1 ring-zinc-200 hover:bg-white dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-600"
          >
            <MonitorPlay className="h-3.5 w-3.5" aria-hidden /> {formatFollowers(followers.twitch)}
          </a>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 sm:ml-auto">
        <button
          type="button"
          disabled={busy}
          onClick={() => void toggleFollow()}
          className="inline-flex items-center gap-2 rounded-full border border-zinc-900 bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          <UserPlus className="h-4 w-4" />
          {following ? "Following" : "Follow"} ({count})
        </button>
        <button
          type="button"
          onClick={() => void onMessage()}
          className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
        >
          <MessageCircle className="h-4 w-4" /> Message
        </button>
        <Link
          href={PUBLIC_SHOPS_PATH}
          className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          <Users className="h-4 w-4" /> Boutiques
        </Link>
      </div>
    </div>
  )
}
