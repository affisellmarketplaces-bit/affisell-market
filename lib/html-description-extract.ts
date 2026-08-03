import "server-only"

import * as cheerio from "cheerio"

import {
  descriptionHasImageMarkers,
  stripDescriptionImageMarkers,
} from "@/lib/description-rich-content"
import {
  extractHtmlDescriptionLight,
  looksLikeHtmlDescription,
  type ExtractedHtmlDescription,
} from "@/lib/html-description-extract-shared"

export {
  extractHtmlDescriptionLight,
  looksLikeHtmlDescription,
  sanitizeListingDescriptionField,
  type ExtractedHtmlDescription,
} from "@/lib/html-description-extract-shared"

function absolutizeImgSrc(raw: string): string | null {
  const t = raw.trim().replace(/^\/\//, "https://")
  if (!t) return null
  if (/^https?:\/\//i.test(t)) return t
  if (t.startsWith("/")) return `https://ae01.alicdn.com${t}`
  return null
}

function isUsableIllustrationUrl(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false
  if (/\.svg(\?|$)/i.test(url)) return false
  if (/pixel|spacer|1x1|blank\.gif|tracking/i.test(url)) return false
  return true
}

/**
 * Full HTML → plain text + illustrative images (cheerio).
 * Inserts [[img:N]] at image positions so text + photos are both preserved.
 */
export function extractHtmlDescriptionContent(
  input: string,
  opts?: { insertImageMarkers?: boolean; maxImages?: number; maxText?: number }
): ExtractedHtmlDescription {
  const insertMarkers = opts?.insertImageMarkers !== false
  const maxImages = Math.min(80, Math.max(1, opts?.maxImages ?? 40))
  const maxText = Math.min(50_000, Math.max(500, opts?.maxText ?? 20_000))
  const raw = input.trim()
  if (!raw) return { text: "", imageUrls: [], hadHtml: false }

  if (!looksLikeHtmlDescription(raw)) {
    return { text: raw.slice(0, maxText), imageUrls: [], hadHtml: false }
  }

  try {
    const $ = cheerio.load(`<div id="affisell-desc-root">${raw}</div>`)
    $("script, style, noscript, iframe, svg").remove()

    const imageUrls: string[] = []
    const seen = new Set<string>()

    const pushImage = (rawSrc: string, replaceNode?: { remove: () => unknown; replaceWith: (html: string) => unknown }) => {
      const abs = absolutizeImgSrc(rawSrc)
      if (!abs || !isUsableIllustrationUrl(abs) || seen.has(abs) || imageUrls.length >= maxImages) {
        replaceNode?.remove()
        return
      }
      seen.add(abs)
      const idx = imageUrls.length
      imageUrls.push(abs)
      if (replaceNode) {
        if (insertMarkers) replaceNode.replaceWith(`\n[[img:${idx}]]\n`)
        else replaceNode.remove()
      }
    }

    $("#affisell-desc-root img").each((_, el) => {
      const node = $(el)
      const src =
        node.attr("src") ||
        node.attr("data-src") ||
        node.attr("data-lazy-src") ||
        node.attr("data-original") ||
        node.attr("data-url") ||
        ""
      pushImage(src, node)
    })

    // AE richtext often embeds illustrative photos as background-image or deep links
    $("#affisell-desc-root [style*='background']").each((_, el) => {
      const style = $(el).attr("style") || ""
      const m = /url\(\s*['"]?([^'")\s]+)['"]?\s*\)/i.exec(style)
      if (m?.[1]) pushImage(m[1])
    })
    $("#affisell-desc-root a[href]").each((_, el) => {
      const href = ($(el).attr("href") || "").trim()
      if (/\.(jpe?g|png|webp|gif)(\?|$)/i.test(href)) {
        pushImage(href)
      }
    })

    $("#affisell-desc-root br, #affisell-desc-root hr").replaceWith("\n")
    $("#affisell-desc-root li").prepend("\n• ")
    $("#affisell-desc-root p, #affisell-desc-root div, #affisell-desc-root h1, #affisell-desc-root h2, #affisell-desc-root h3, #affisell-desc-root h4, #affisell-desc-root section, #affisell-desc-root tr").append("\n")

    let text = $("#affisell-desc-root").text()
    text = text
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim()
      .slice(0, maxText)

    text = text.replace(/(\[\[img:\d+\]\])\s*(?=\[\[img:)/g, "$1\n")

    return { text, imageUrls, hadHtml: true }
  } catch {
    return extractHtmlDescriptionLight(raw, {
      insertImageMarkers: insertMarkers,
      maxImages,
    })
  }
}

/** Idempotent normalize for Product.description (+ illustration URLs). */
export function normalizeProductDescriptionFields(input: {
  description: string
  descriptionIllustrationImages?: string[] | null
}): {
  description: string
  descriptionIllustrationImages: string[]
  changed: boolean
} {
  const existing = (input.descriptionIllustrationImages ?? [])
    .filter((u) => typeof u === "string" && /^https?:\/\//i.test(u.trim()))
    .map((u) => u.trim())

  let description = input.description
  let images = existing
  let changed = false

  if (looksLikeHtmlDescription(description)) {
    const extracted = extractHtmlDescriptionContent(description)
    const merged: string[] = []
    const seen = new Set<string>()
    for (const u of [...extracted.imageUrls, ...existing]) {
      const t = u.trim()
      if (!t || seen.has(t)) continue
      seen.add(t)
      merged.push(t)
      if (merged.length >= 40) break
    }
    description = extracted.text || description.replace(/<[^>]+>/g, " ").trim()
    images = merged
    changed = true
  }

  // Orphan markers with no illustration URLs → strip (can't render photos; never leak tags).
  // Markers + URLs → keep for DescriptionRichContent.
  if (descriptionHasImageMarkers(description) && images.length === 0) {
    const cleaned = stripDescriptionImageMarkers(description)
    if (cleaned !== description) {
      description = cleaned
      changed = true
    }
  }

  return {
    description,
    descriptionIllustrationImages: images,
    changed,
  }
}
