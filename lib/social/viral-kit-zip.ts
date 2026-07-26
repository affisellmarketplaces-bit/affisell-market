import JSZip from "jszip"

import { socialKeysForPlatforms } from "@/lib/social/platform-keys"
import type { SocialAssetSpec } from "@/lib/social/bubble-product-types"

export type ViralKitProgress = {
  done: number
  total: number
  ratio: number
}

/**
 * One-click launch kit: selected platform PNGs + captions.txt (Amazon Influencer style).
 * Idempotent — safe to re-run; no OAuth side effects.
 */
export async function downloadViralLaunchKit(opts: {
  productId: string
  assets: SocialAssetSpec[]
  platforms: string[]
  captionsTxt: string
  onProgress?: (p: ViralKitProgress) => void
}): Promise<{ fileCount: number; keys: string[] }> {
  const wanted = new Set(socialKeysForPlatforms(opts.platforms))
  const selected =
    wanted.size > 0
      ? opts.assets.filter((a) => wanted.has(a.key))
      : opts.assets

  if (selected.length === 0 && !opts.captionsTxt.trim()) {
    throw new Error("empty_kit")
  }

  const zip = new JSZip()
  const folder = zip.folder(`affisell-viral-${opts.productId}`) ?? zip
  folder.file("captions.txt", opts.captionsTxt || "# captions\n")
  folder.file(
    "README.txt",
    [
      "Affisell Viral Launch Kit",
      "=========================",
      "1. Ouvre captions.txt — copie le hook qui match ta plateforme.",
      "2. Upload le PNG adapté (Story / Feed / TikTok / …).",
      "3. Colle le lien bubble Affisell dans ta bio / commentaire épinglé.",
      "",
      "Confidentialité: ces assets n'affichent jamais ta marge.",
      `Généré: ${new Date().toISOString()}`,
    ].join("\n")
  )

  const total = selected.length
  let done = 0
  const keys: string[] = []

  for (const asset of selected) {
    const res = await fetch(asset.publicUrl, { credentials: "same-origin" })
    if (!res.ok) {
      console.log("[viral-kit]", { result: "asset_skip", key: asset.key, status: res.status })
      done += 1
      opts.onProgress?.({ done, total: Math.max(1, total), ratio: done / Math.max(1, total) })
      continue
    }
    const buf = await res.arrayBuffer()
    folder.file(`${asset.key}.png`, buf)
    keys.push(asset.key)
    done += 1
    opts.onProgress?.({ done, total: Math.max(1, total), ratio: done / Math.max(1, total) })
  }

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `affisell-viral-${opts.productId}.zip`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000)

  console.log("[viral-kit]", {
    result: "downloaded",
    productId: opts.productId,
    fileCount: keys.length + 2,
    keys,
  })

  return { fileCount: keys.length + 2, keys }
}
