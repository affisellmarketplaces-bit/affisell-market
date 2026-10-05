"use client"

import Link from "next/link"
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react"

import { useDonaLinkClick } from "@/components/dona/dona-navigation"
import { DONA_LINKABLE_FIRST_SEGMENTS, DONA_SITE_HOSTS, toInternalPath } from "@/lib/dona/dona-links"
import type { DonaProductHit } from "@/lib/dona/dona-product-types"
import { formatStoreCurrency } from "@/lib/market-config"

// Only characters that are valid in a URL path/query. Anything else (markdown `*`, quotes, `·`,
// `→`, emoji, `)`) ends the link instead of being swallowed into the href — a polluted href is
// what turned Dona's affiliate signup link into a broken request.
const URL_CHAR = String.raw`(?:[A-Za-z0-9\-._~/?=&#+@:]|%[0-9A-Fa-f]{2})`
const LINK_CLASS = "font-medium text-violet-300 underline underline-offset-2 hover:text-violet-200"

const SEGMENTS = DONA_LINKABLE_FIRST_SEGMENTS.map((seg) => seg.replace(/[-/]/g, "\\$&")).join("|")
const HOSTS = DONA_SITE_HOSTS.map((h) => h.replace(/\./g, "\\.")).join("|")

// Alternation order matters: markdown link, then absolute URL, then our own host + path without a scheme (models often
// write `affisell.com/signup/supplier`; a bare "affisell.com" or an e-mail address is left alone), then a bare internal
// path (which may sit anywhere in the sentence).
const TOKEN_RE = new RegExp(
  String.raw`\[([^\]]+)\]\(([^)\s]+)\)` +
    String.raw`|(https?:\/\/${URL_CHAR}+)` +
    String.raw`|(?<![\w/:.@-])((?:${HOSTS})\/${URL_CHAR}+)` +
    String.raw`|(?<![\w/:.])(\/(?:${SEGMENTS})(?![A-Za-z0-9_])${URL_CHAR}*)`,
  "gi"
)

const TRAILING_PUNCT_RE = /[.,;:!?]+$/

/** LLM replies wrap paths in **bold** / `code`; those markers are noise for a plain-text bubble. */
function stripInlineMarkers(line: string): string {
  return line.replace(/\*\*|__|`/g, "")
}

function renderPlainWithLinks(
  rawText: string,
  keyPrefix: string,
  onLinkClick: (e: ReactMouseEvent) => void
): ReactNode[] {
  const text = stripInlineMarkers(rawText)
  const out: ReactNode[] = []
  let key = 0
  let cursor = 0

  for (const match of text.matchAll(TOKEN_RE)) {
    const idx = match.index ?? 0
    if (idx > cursor) out.push(text.slice(cursor, idx))
    cursor = idx + match[0].length

    const [whole, mdLabel, mdHref, bareUrl, siteHost, internalPath] = match

    if (mdLabel != null && mdHref != null) {
      // Our own pages (relative, or absolute on our host) navigate in-app; anything else opens in a new tab.
      const internal = toInternalPath(mdHref)
      if (internal) {
        out.push(
          <Link key={`${keyPrefix}-${key++}`} href={internal} className={LINK_CLASS} onClick={onLinkClick}>
            {mdLabel}
          </Link>
        )
      } else if (/^https?:\/\//i.test(mdHref)) {
        out.push(
          <a
            key={`${keyPrefix}-${key++}`}
            href={mdHref}
            target="_blank"
            rel="noopener noreferrer"
            className={LINK_CLASS}
          >
            {mdLabel}
          </a>
        )
      } else {
        out.push(whole)
      }
      continue
    }

    const raw = bareUrl ?? siteHost ?? internalPath ?? ""
    const trail = raw.match(TRAILING_PUNCT_RE)?.[0] ?? ""
    const href = trail ? raw.slice(0, -trail.length) : raw
    const internal = toInternalPath(href)
    if (internal) {
      out.push(
        <Link key={`${keyPrefix}-${key++}`} href={internal} className={LINK_CLASS} onClick={onLinkClick}>
          {internal}
        </Link>
      )
    } else {
      out.push(
        <a
          key={`${keyPrefix}-${key++}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={LINK_CLASS}
        >
          {href}
        </a>
      )
    }
    if (trail) out.push(trail)
  }

  if (cursor < text.length) out.push(text.slice(cursor))
  return out
}

export function DonaLinkifiedText({ text }: { text: string }) {
  const onLinkClick = useDonaLinkClick()
  const lines = text.split("\n")
  return (
    <span className="whitespace-pre-wrap break-words">
      {lines.map((line, i) => (
        <span key={`line-${i}`}>
          {i > 0 ? <br /> : null}
          {renderPlainWithLinks(line, `l${i}`, onLinkClick)}
        </span>
      ))}
    </span>
  )
}

function DonaProductCardItem({ p }: { p: DonaProductHit }) {
  const onLinkClick = useDonaLinkClick()
  return (
    <Link
      href={p.url}
      onClick={onLinkClick}
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
