"use client"

import { Music, Share2 } from "lucide-react"
import { signIn } from "next-auth/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useState } from "react"

type LinkedRow = { id: string; provider: string }

const LABEL: Record<string, string> = {
  google: "Google",
  facebook: "Facebook",
  apple: "Apple",
  twitter: "X (Twitter)",
}

function badgeClass(provider: string) {
  switch (provider) {
    case "google":
      return "border-zinc-200 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
    case "facebook":
      return "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100"
    case "apple":
      return "border-zinc-900 bg-black text-white dark:border-zinc-600"
    case "twitter":
      return "border-zinc-800 bg-zinc-900 text-white dark:border-zinc-600"
    default:
      return "border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
  }
}

type Props = {
  initialLinked: LinkedRow[]
  hasPassword: boolean
}

export function ConnectedAccountsPanel({ initialLinked, hasPassword }: Props) {
  const router = useRouter()
  const [linked, setLinked] = useState(initialLinked)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const res = await fetch("/api/account/linked", { credentials: "include" })
    const j = (await res.json()) as { accounts?: LinkedRow[] }
    if (res.ok && j.accounts) setLinked(j.accounts)
  }, [])

  async function connect(provider: string) {
    setBusy(provider)
    setError(null)
    await signIn(provider, { callbackUrl: "/dashboard/settings/account" })
    setBusy(null)
  }

  async function disconnect(provider: string) {
    setBusy(`rm-${provider}`)
    setError(null)
    try {
      const res = await fetch("/api/account/linked", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ provider }),
      })
      const j = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(j.error ?? "Could not disconnect")
      await refresh()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error")
    } finally {
      setBusy(null)
    }
  }

  const has = (p: string) => linked.some((a) => a.provider === p)

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Connected accounts</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Link social logins to sign in faster. If you remove your only provider, keep a password so you can still access your account.
      </p>

      {error ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{error}</p> : null}

      <ul className="mt-6 space-y-3">
        {(["google", "facebook", "apple", "twitter"] as const).map((p) => (
          <li key={p} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(p)}`}>
              {LABEL[p] ?? p}
            </span>
            <div className="flex gap-2">
              {has(p) ? (
                <button
                  type="button"
                  disabled={busy !== null}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  onClick={() => void disconnect(p)}
                >
                  {busy === `rm-${p}` ? "…" : "Disconnect"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy !== null}
                  className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                  onClick={() => void connect(p)}
                >
                  {busy === p ? "…" : "Connect"}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {!hasPassword ? (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          You do not have a password yet. Disconnecting your only social login would lock you out — set a password from your profile flow when available, or add a second provider first.
        </p>
      ) : null}

      <div className="mt-10 border-t border-zinc-100 pt-6 dark:border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">More social presence</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Instagram and TikTok are not OAuth-linked here yet. Add your handles in social settings for your storefront.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/dashboard/settings/social"
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            <Share2 className="h-4 w-4" /> Connect Instagram
          </Link>
          <Link
            href="/dashboard/settings/social"
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            <Music className="h-4 w-4" /> Connect TikTok
          </Link>
        </div>
      </div>
    </section>
  )
}
