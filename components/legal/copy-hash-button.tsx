"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"

type Props = {
  value: string
  label?: string
}

export function CopyHashButton({ value, label = "Copier le hash" }: Props) {
  const [copied, setCopied] = useState(false)

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onCopy()}
      className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
      aria-label={label}
      title={label}
    >
      {copied ? (
        <>
          <Check className="size-3.5 text-emerald-600" aria-hidden />
          Copié
        </>
      ) : (
        <>
          <Copy className="size-3.5" aria-hidden />
          Copier
        </>
      )}
    </button>
  )
}
