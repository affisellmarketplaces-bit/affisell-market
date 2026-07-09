"use client"

import type { FormEvent } from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"

import { cn } from "@/lib/utils"

type Props = {
  docSlug: string
  docTitle: string
  locale: string
  returnTo: string
  className?: string
}

type LegalDocResponse = {
  meta: { version: string; title: string }
  content: string
}

export function ReacceptLegalForm({
  docSlug,
  docTitle,
  locale,
  returnTo,
  className,
}: Props) {
  const router = useRouter()
  const { update } = useSession()
  const [accepted, setAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [doc, setDoc] = useState<LegalDocResponse | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await fetch(`/api/legal/document/${docSlug}?locale=${locale}`)
      if (!res.ok) return
      const data = (await res.json()) as LegalDocResponse
      if (!cancelled) setDoc(data)
    })()
    return () => {
      cancelled = true
    }
  }, [docSlug, locale])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!accepted) {
      setError("Vous devez accepter le document pour continuer.")
      return
    }
    setLoading(true)
    setError(null)

    const res = await fetch("/api/legal/acceptance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: docSlug, locale }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      error?: string
      missingDocument?: string | null
    }
    setLoading(false)

    if (!res.ok) {
      setError(data.error ?? "Enregistrement impossible.")
      return
    }

    await update()

    if (data.missingDocument) {
      const u = new URL("/reaccept-terms", window.location.origin)
      u.searchParams.set("doc", data.missingDocument)
      u.searchParams.set("returnTo", returnTo)
      router.push(`${u.pathname}${u.search}`)
      router.refresh()
      return
    }

    router.push(returnTo.startsWith("/") ? returnTo : `/${returnTo}`)
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className={cn("space-y-6", className)}>
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        <p className="font-semibold">{docTitle}</p>
        {doc ? (
          <p className="mt-1 font-mono text-xs text-amber-100/90">Version {doc.meta.version}</p>
        ) : null}
      </div>

      <div className="max-h-72 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
        {doc ? (
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{doc.content}</pre>
        ) : (
          <p className="text-zinc-500">Chargement du document…</p>
        )}
      </div>

      <label className="flex cursor-pointer items-start gap-3 text-sm text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-1"
        />
        <span>
          J&apos;ai lu et j&apos;accepte <strong>{docTitle}</strong> (version courante).
        </span>
      </label>

      <button
        type="submit"
        disabled={!accepted || loading || !doc}
        className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
      >
        {loading ? "Enregistrement…" : "J'accepte et je continue"}
      </button>

      {error ? <p className="text-center text-sm text-rose-600 dark:text-rose-300">{error}</p> : null}
    </form>
  )
}
