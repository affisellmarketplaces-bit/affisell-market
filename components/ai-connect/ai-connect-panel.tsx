"use client"

import { useCallback, useEffect, useState } from "react"
import { useLocale, useTranslations } from "next-intl"

import { BentoCard } from "@/components/affisell/bento-ui"

type KeyRow = { id: string; label: string; prefix: string; createdAt: string; lastUsedAt: string | null }
type MissionRow = {
  id: string
  tool: string
  status: string
  error: string | null
  createdAt: string
  keyLabel: string | null
}

const STATUS_STYLE: Record<string, string> = {
  done: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  failed: "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300",
  running: "bg-violet-50 text-violet-800 dark:bg-violet-950/40 dark:text-violet-200",
  queued: "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
}

function CodeBlock({ text, copyLabel, copiedLabel }: { text: string; copyLabel: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-xl bg-zinc-950 p-4 pr-24 text-xs leading-relaxed text-zinc-100">{text}</pre>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(text).then(() => {
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1800)
          })
        }}
        className="absolute right-2 top-2 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
      >
        {copied ? copiedLabel : copyLabel}
      </button>
    </div>
  )
}

export function AiConnectPanel() {
  const t = useTranslations("aiConnect")
  const locale = useLocale()
  const [keys, setKeys] = useState<KeyRow[]>([])
  const [missions, setMissions] = useState<MissionRow[]>([])
  const [label, setLabel] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fresh, setFresh] = useState<{ key: string } | null>(null)
  const [origin, setOrigin] = useState("")

  useEffect(() => setOrigin(window.location.origin), [])

  const load = useCallback(async () => {
    try {
      const [k, m] = await Promise.all([
        fetch("/api/ai-connect/keys", { credentials: "include" }),
        fetch("/api/ai-connect/missions", { credentials: "include" }),
      ])
      if (!k.ok || !m.ok) throw new Error("load")
      setKeys(((await k.json()) as { keys: KeyRow[] }).keys)
      setMissions(((await m.json()) as { missions: MissionRow[] }).missions)
      setError(null)
    } catch {
      setError(t("loadError"))
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  async function createKey() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/ai-connect/keys", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      })
      if (res.status === 409) {
        setError(t("maxKeys"))
        return
      }
      if (!res.ok) throw new Error("create")
      const data = (await res.json()) as { key: string }
      setFresh({ key: data.key })
      setLabel("")
      await load()
    } catch {
      setError(t("loadError"))
    } finally {
      setBusy(false)
    }
  }

  async function revoke(id: string) {
    if (!window.confirm(t("revokeConfirm"))) return
    const res = await fetch("/api/ai-connect/keys", {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    if (!res.ok) setError(t("loadError"))
    setFresh(null)
    await load()
  }

  const mcpUrl = `${origin}/api/mcp`
  const keyForSnippet = fresh?.key ?? "YOUR_AFFISELL_KEY"
  const fmt = (iso: string) => new Date(iso).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })
  const claudeCmd = `claude mcp add --transport http affisell ${mcpUrl} --header "Authorization: Bearer ${keyForSnippet}"`
  const jsonCfg = JSON.stringify(
    { mcpServers: { affisell: { type: "http", url: mcpUrl, headers: { Authorization: `Bearer ${keyForSnippet}` } } } },
    null,
    2
  )

  return (
    <div className="space-y-6">
      {error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        <BentoCard className="space-y-2">
          <h2 className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{t("canTitle")}</h2>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
            <li>{t("can1")}</li>
            <li>{t("can2")}</li>
            <li>{t("can3")}</li>
          </ul>
        </BentoCard>
        <BentoCard className="space-y-2">
          <h2 className="text-lg font-bold text-red-700 dark:text-red-400">{t("cannotTitle")}</h2>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">{t("cannot")}</p>
        </BentoCard>
      </div>

      <BentoCard className="space-y-4">
        <h2 className="text-lg font-bold">{t("keysTitle")}</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={80}
            placeholder={t("labelPlaceholder")}
            aria-label={t("labelPlaceholder")}
            className="min-h-11 flex-1 rounded-xl border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button
            type="button"
            onClick={() => void createKey()}
            disabled={busy}
            className="min-h-11 rounded-xl bg-violet-600 px-5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {busy ? t("creating") : t("create")}
          </button>
        </div>

        {fresh ? (
          <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">{t("newKeyTitle")}</p>
            <p className="text-xs text-amber-800 dark:text-amber-300">{t("newKeyHint")}</p>
            <CodeBlock text={fresh.key} copyLabel={t("copy")} copiedLabel={t("copied")} />
          </div>
        ) : null}

        {keys.length === 0 ? (
          <p className="text-sm text-zinc-500">{t("noKeys")}</p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {keys.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{k.label}</p>
                  <p className="text-xs text-zinc-500">
                    <code>{k.prefix}…</code> · {t("createdOn")} {fmt(k.createdAt)} · {t("lastUsed")}{" "}
                    {k.lastUsedAt ? fmt(k.lastUsedAt) : t("never")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void revoke(k.id)}
                  className="min-h-11 rounded-xl px-3 text-sm font-semibold text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                >
                  {t("revoke")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </BentoCard>

      <BentoCard className="space-y-4">
        <h2 className="text-lg font-bold">{t("setupTitle")}</h2>
        <div className="space-y-1">
          <p className="text-sm font-semibold">{t("setupUrl")}</p>
          <CodeBlock text={mcpUrl} copyLabel={t("copy")} copiedLabel={t("copied")} />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold">{t("setupClaude")}</p>
          <CodeBlock text={claudeCmd} copyLabel={t("copy")} copiedLabel={t("copied")} />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold">{t("setupJson")}</p>
          <CodeBlock text={jsonCfg} copyLabel={t("copy")} copiedLabel={t("copied")} />
        </div>
      </BentoCard>

      <BentoCard className="space-y-3">
        <h2 className="text-lg font-bold">{t("logTitle")}</h2>
        {missions.length === 0 ? (
          <p className="text-sm text-zinc-500">{t("noMissions")}</p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {missions.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <div className="min-w-0">
                  <code className="font-semibold">{m.tool}</code>
                  <span className="ml-2 text-xs text-zinc-500">
                    {m.keyLabel ? `${m.keyLabel} · ` : ""}
                    {fmt(m.createdAt)}
                  </span>
                  {m.error ? <p className="text-xs text-red-700 dark:text-red-400">{m.error}</p> : null}
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[m.status] ?? STATUS_STYLE.queued}`}>
                  {t(`status_${m.status}` as "status_done")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </BentoCard>
    </div>
  )
}
