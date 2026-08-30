"use client"

import Link from "next/link"
import type { ReactNode } from "react"

import type { DonaProductHit } from "@/lib/dona/dona-product-types"
import { formatStoreCurrency } from "@/lib/market-config"

const INTERNAL_PATH_RE = /^(\/(?:marketplace|product|discover|shops|cart|checkout|signup|login)[^\s]*)/i
const MARKDOWN_LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g
const BARE_URL_RE = /(https?:\/\/[^\s]+)/g

type TextSegment = { kind: "text"; value: string }
type LinkSegment = { kind: "link"; href: string; label: string }

function splitInternalPaths(text: string): Array<TextSegment | LinkSegment> {
  const segments: Array<TextSegment | LinkSegment> = []
  let cursor = 0

  const pushText = (end: number) => {
    if (end > cursor) segments.push({ kind: "text", value: text.slice(cursor, end) })
  }

  for (const match of text.matchAll(new RegExp(INTERNAL_PATH_RE.source, "gi"))) {
    const idx = match.index ?? 0
    pushText(idx)
    const href = match[1]?.replace(/[.,;:!?)]+$/, "") ?? ""
    if (href) segments.push({ kind: "link", href, label: href })
    cursor = idx + match[0].length
  }

  if (cursor < text.length) segments.push({ kind: "text", value: text.slice(cursor) })
  if (segments.length === 0) segments.push({ kind: "text", value: text })
  return segments
}

function renderPlainWithLinks(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = []
  let key = 0

  for (const segment of splitInternalPaths(text)) {
    if (segment.kind === "link") {
      out.push(
        <Link
          key={`${keyPrefix}-${key++}`}
          href={segment.href}
          className="font-medium text-violet-300 underline underline-offset-2 hover:text-violet-200"
        >
          {segment.label}
        </Link>
      )
      continue
    }

    let chunk = segment.value
    let lastIndex = 0
    const mdRe = new RegExp(MARKDOWN_LINK_RE.source, "g")
    for (const match of chunk.matchAll(mdRe)) {
      const idx = match.index ?? 0
      if (idx > lastIndex) out.push(chunk.slice(lastIndex, idx))
      const label = match[1] ?? ""
      const href = match[2] ?? ""
      if (href.startsWith("/") || href.startsWith("http")) {
        out.push(
          href.startsWith("/") ? (
            <Link
              key={`${keyPrefix}-${key++}`}
              href={href}
              className="font-medium text-violet-300 underline underline-offset-2 hover:text-violet-200"
            >
              {label}
            </Link>
          ) : (
            <a
              key={`${keyPrefix}-${key++}`}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-violet-300 underline underline-offset-2 hover:text-violet-200"
            >
              {label}
            </a>
          )
        )
      } else {
        out.push(match[0])
      }
      lastIndex = idx + match[0].length
    }

    const tail = chunk.slice(lastIndex)
    let urlCursor = 0
    const urlRe = new RegExp(BARE_URL_RE.source, "g")
    for (const match of tail.matchAll(urlRe)) {
      const idx = match.index ?? 0
      if (idx > urlCursor) out.push(tail.slice(urlCursor, idx))
      const href = match[1] ?? ""
      out.push(
        <a
          key={`${keyPrefix}-${key++}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-violet-300 underline underline-offset-2 hover:text-violet-200"
        >
          {href}
        </a>
      )
      urlCursor = idx + match[0].length
    }
    if (urlCursor < tail.length) out.push(tail)
  }

  return out
}

export function DonaLinkifiedText({ text }: { text: string }) {
  const lines = text.split("\n")
  return (
    <span className="whitespace-pre-wrap break-words">
      {lines.map((line, i) => (
        <span key={`line-${i}`}>
          {i > 0 ? <br /> : null}
          {renderPlainWithLinks(line, `l${i}`)}
        </span>
      ))}
    </span>
  )
}

function DonaProductCardItem({ p }: { p: DonaProductHit }) {
  return (
    <Link
      href={p.url}
      className="flex gap-3 rounded-xl border border-white/10 bg-[#12122e] p-2.5 transition hover:border-violet-500/40 hover:bg-[#161636]"
    >
      <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-[#0E0E2C]">
        {p.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote supplier URLs in chat widget
          <img src={p.imageUrl} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <div className="flex size-full items-center justify-center text-[10px] text-white/30">—</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-xs font-semibold text-white">{p.name}</p>
        <p className="mt-0.5 truncate text-[10px] text-white/50">{p.brand}</p>
        <p className="mt-1 text-sm font-bold text-violet-200">{formatStoreCurrency(p.price)}</p>
      </div>
    </Link>
  )
}

export function DonaProductCards({
  products,
  title,
}: {
  products: DonaProductHit[]
  title?: string
}) {
  const list = products.slice(0, 3)
  if (list.length === 0) return null
  return (
    <div className="mt-2 space-y-2">
      {title ? <p className="text-[10px] font-medium uppercase tracking-wide text-violet-300/80">{title}</p> : null}
      {list.map((p) => (
        <DonaProductCardItem key={p.listingId} p={p} />
      ))}
    </div>
  )
}
