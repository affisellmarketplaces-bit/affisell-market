"use client"

import { MessageCircle, MonitorPlay, Music, Share2, Tv, Users } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { formatFollowers, parseFollowersJson } from "@/lib/format-followers"

export type SerializedStoreSocial = {
  id: string
  updatedAt: string | Date
  instagram?: string | null
  tiktok?: string | null
  youtube?: string | null
  twitch?: string | null
  twitter?: string | null
  followers?: unknown
  showSocialsOnStore?: boolean
  autoSyncFollowersDaily?: boolean
  isLive?: boolean
  livePlatform?: string | null
  liveUrl?: string | null
}

type Props = {
  initialStore: SerializedStoreSocial
}

export function SocialSettingsForm({ initialStore }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [instagram, setInstagram] = useState(() => initialStore.instagram ?? "")
  const [tiktok, setTiktok] = useState(() => initialStore.tiktok ?? "")
  const [youtube, setYoutube] = useState(() => initialStore.youtube ?? "")
  const [twitch, setTwitch] = useState(() => initialStore.twitch ?? "")
  const [twitter, setTwitter] = useState(() => initialStore.twitter ?? "")
  const [showSocialsOnStore, setShowSocialsOnStore] = useState(() => initialStore.showSocialsOnStore ?? true)
  const [autoSyncDaily, setAutoSyncDaily] = useState(() => initialStore.autoSyncFollowersDaily ?? false)
  const [liveLabel, setLiveLabel] = useState(() => ({
    isLive: Boolean(initialStore.isLive),
    platform: initialStore.livePlatform ?? null,
  }))
  const [followersJson, setFollowersJson] = useState(() => parseFollowersJson(initialStore.followers ?? null))

  async function saveProfiles() {
    setBusy("save")
    setError(null)
    try {
      const res = await fetch("/api/store/social", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          instagram,
          tiktok,
          youtube,
          twitch,
          twitter,
          showSocialsOnStore,
          autoSyncFollowersDaily: autoSyncDaily,
        }),
      })
      const j = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(j.error ?? "Save failed")
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(null)
    }
  }

  async function sync(platform?: string) {
    setBusy(platform ?? "all")
    setError(null)
    try {
      const res = await fetch("/api/social/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(platform ? { platform } : {}),
      })
      const j = (await res.json()) as { error?: string; followers?: unknown }
      if (!res.ok) throw new Error(j.error ?? "Sync failed")
      if (j.followers != null) setFollowersJson(parseFollowersJson(j.followers))
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(null)
    }
  }

  async function checkLive() {
    setBusy("live")
    setError(null)
    try {
      const res = await fetch("/api/social/live-status", { method: "POST", credentials: "include" })
      const j = (await res.json()) as { error?: string; isLive?: boolean; livePlatform?: string | null }
      if (!res.ok) throw new Error(j.error ?? "Live check failed")
      setLiveLabel({ isLive: Boolean(j.isLive), platform: j.livePlatform ?? null })
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(null)
    }
  }

  async function refreshAll() {
    await sync(undefined)
    await checkLive()
  }

  const statLine =
    `${formatFollowers(followersJson.instagram)} Instagram · ` +
    `${formatFollowers(followersJson.tiktok)} TikTok` +
    (followersJson.youtube != null ? ` · ${formatFollowers(followersJson.youtube)} YouTube` : "") +
    (followersJson.twitch != null ? ` · ${formatFollowers(followersJson.twitch)} Twitch` : "")

  return (
    <div className="space-y-10">
      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          <Users className="h-5 w-5 text-teal-600" /> Social snapshot
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{statLine}</p>
        {liveLabel.isLive ? (
          <p className="mt-3 flex flex-wrap items-center gap-2 text-sm font-semibold text-red-600">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
            </span>
            LIVE NOW{liveLabel.platform ? ` on ${liveLabel.platform}` : ""}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void refreshAll()}
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {busy === "all" ? "Refreshing…" : "Refresh Stats"}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void checkLive()}
            className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Check live status
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void saveProfiles()}
            className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-900 hover:bg-teal-100 disabled:opacity-60 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-100"
          >
            {busy === "save" ? "Saving…" : "Save handles & preferences"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Connect Your Socials</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Use @handles or channel identifiers (saved without @).</p>

        <div className="mt-6 space-y-5">
          <div className="flex flex-wrap items-end gap-2">
            <label className="block min-w-[200px] flex-1">
              <span className="flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                <Share2 className="h-4 w-4" /> Instagram
              </span>
              <span className="mt-1 flex rounded-lg border border-zinc-200 dark:border-zinc-700">
                <span className="flex shrink-0 items-center border-r border-zinc-200 px-2 text-sm text-zinc-500 dark:border-zinc-700">
                  @
                </span>
                <input
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  className="w-full rounded-r-lg bg-transparent px-2 py-2 text-sm outline-none"
                  placeholder="techstore_fr"
                />
              </span>
            </label>
            <button
              type="button"
              disabled={busy !== null}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800"
              onClick={() => void sync("instagram")}
            >
              Sync followers
            </button>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <label className="block min-w-[200px] flex-1">
              <span className="flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                <Music className="h-4 w-4" /> TikTok
              </span>
              <span className="mt-1 flex rounded-lg border border-zinc-200 dark:border-zinc-700">
                <span className="flex shrink-0 items-center border-r border-zinc-200 px-2 text-sm text-zinc-500 dark:border-zinc-700">
                  @
                </span>
                <input
                  value={tiktok}
                  onChange={(e) => setTiktok(e.target.value)}
                  className="w-full rounded-r-lg bg-transparent px-2 py-2 text-sm outline-none"
                  placeholder="techstore"
                />
              </span>
            </label>
            <button
              type="button"
              disabled={busy !== null}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800"
              onClick={() => void sync("tiktok")}
            >
              Sync
            </button>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <label className="block min-w-[200px] flex-1">
              <span className="flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                <Tv className="h-4 w-4" /> YouTube
              </span>
              <span className="mt-1 flex rounded-lg border border-zinc-200 dark:border-zinc-700">
                <span className="flex shrink-0 items-center border-r border-zinc-200 px-2 text-sm text-zinc-500 dark:border-zinc-700">
                  @ / channel
                </span>
                <input
                  value={youtube}
                  onChange={(e) => setYoutube(e.target.value)}
                  className="w-full rounded-r-lg bg-transparent px-2 py-2 text-sm outline-none"
                  placeholder="channel"
                />
              </span>
            </label>
            <button
              type="button"
              disabled={busy !== null}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800"
              onClick={() => void sync("youtube")}
            >
              Sync
            </button>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <label className="block min-w-[200px] flex-1">
              <span className="flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                <MonitorPlay className="h-4 w-4" /> Twitch
              </span>
              <span className="mt-1 flex rounded-lg border border-zinc-200 dark:border-zinc-700">
                <span className="flex shrink-0 items-center border-r border-zinc-200 px-2 text-sm text-zinc-500 dark:border-zinc-700">
                  @
                </span>
                <input
                  value={twitch}
                  onChange={(e) => setTwitch(e.target.value)}
                  className="w-full rounded-r-lg bg-transparent px-2 py-2 text-sm outline-none"
                  placeholder="username"
                />
              </span>
            </label>
            <button
              type="button"
              disabled={busy !== null}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800"
              onClick={() => void sync("twitch")}
            >
              Sync
            </button>
          </div>

          <div>
            <label className="block min-w-[200px] flex-1">
              <span className="flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                <MessageCircle className="h-4 w-4" /> X (Twitter)
              </span>
              <span className="mt-1 flex rounded-lg border border-zinc-200 dark:border-zinc-700">
                <span className="flex shrink-0 items-center border-r border-zinc-200 px-2 text-sm text-zinc-500 dark:border-zinc-700">
                  @
                </span>
                <input
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                  className="w-full rounded-r-lg bg-transparent px-2 py-2 text-sm outline-none"
                  placeholder="handle"
                />
              </span>
            </label>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Storefront</h2>
        <label className="mt-4 flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Show socials on my store</span>
          <input
            type="checkbox"
            checked={showSocialsOnStore}
            onChange={(e) => setShowSocialsOnStore(e.target.checked)}
            className="h-5 w-5 accent-teal-600"
          />
        </label>
        <label className="mt-3 flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Auto-update followers daily</span>
          <input
            type="checkbox"
            checked={autoSyncDaily}
            onChange={(e) => setAutoSyncDaily(e.target.checked)}
            className="h-5 w-5 accent-teal-600"
          />
        </label>
        <p className="mt-2 text-xs text-zinc-500">
          Daily auto-sync is a preference for future jobs; today you can use Refresh Stats anytime.
        </p>
      </section>
    </div>
  )
}
