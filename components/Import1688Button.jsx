"use client"

import { useState } from "react"

export function Import1688Button() {
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)

  async function onImport() {
    const trimmed = url.trim()
    if (!trimmed || loading) return
    setLoading(true)
    try {
      const res = await fetch("/api/import-1688", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      })
      const data = await res.json()
      if (data.ok) {
        alert(`Produit importé : ${data.product.name}`)
        setUrl("")
      } else {
        alert(`Erreur import : ${data.error}`)
      }
    } catch {
      alert("Erreur réseau — réessayez.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex w-full max-w-xl items-center gap-2">
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onImport()
        }}
        placeholder="https://detail.1688.com/offer/…html"
        disabled={loading}
        className="h-10 min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-500/25 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
      />
      <button
        type="button"
        onClick={onImport}
        disabled={loading || !url.trim()}
        className="h-10 shrink-0 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Import…" : "Importer 1 clic"}
      </button>
    </div>
  )
}

export default Import1688Button
