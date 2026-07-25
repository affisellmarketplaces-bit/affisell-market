import "server-only"

import { mkdir, writeFile, access } from "node:fs/promises"
import path from "node:path"

import { ImageResponse } from "next/og"

import { pickTemplateElement } from "@/components/social/templates/BubbleSocialTemplates"
import type { BubbleProductView } from "@/lib/social/bubble-product-types"
import { SOCIAL_ASSET_DIMENSIONS, type SocialAssetKey } from "@/lib/social/bubble-product-types"
import {
  resolveSocialProductImageSrc,
  SOCIAL_ASSET_TEMPLATE_VERSION,
} from "@/lib/social/resolve-social-product-image"

/**
 * Writable dir for PNG assets.
 * Prefer `public/` locally (static serve). On read-only hosts (Vercel), fall back to `/tmp`.
 */
function generatedDir(productId: string): string {
  const safeId = productId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80)
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join("/tmp", "affisell-social", safeId, SOCIAL_ASSET_TEMPLATE_VERSION)
  }
  return path.join(process.cwd(), "public", "generated", "social", safeId, SOCIAL_ASSET_TEMPLATE_VERSION)
}

export function socialAssetPublicPath(productId: string, key: SocialAssetKey): string {
  const safeId = productId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80)
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return `/api/products/${encodeURIComponent(productId)}/social-assets/download?format=${encodeURIComponent(key)}&v=${SOCIAL_ASSET_TEMPLATE_VERSION}`
  }
  return `/generated/social/${safeId}/${SOCIAL_ASSET_TEMPLATE_VERSION}/${key}.png`
}

export function socialAssetAbsolutePath(productId: string, key: SocialAssetKey): string {
  return path.join(generatedDir(productId), `${key}.png`)
}

export async function socialAssetFileExists(productId: string, key: SocialAssetKey): Promise<boolean> {
  try {
    await access(socialAssetAbsolutePath(productId, key))
    return true
  } catch {
    return false
  }
}

export async function renderSocialAssetPng(
  product: BubbleProductView,
  key: SocialAssetKey
): Promise<{ relativePath: string; publicUrl: string; bytes: number }> {
  const spec = SOCIAL_ASSET_DIMENSIONS[key]
  const dir = generatedDir(product.id)
  await mkdir(dir, { recursive: true })
  const filename = `${key}.png`
  const filePath = path.join(dir, filename)

  const imageSrc = await resolveSocialProductImageSrc(product.imageUrl, product.id)

  const element = pickTemplateElement({
    product,
    imageSrc,
    width: spec.width,
    height: spec.height,
    template: spec.template,
    safeZone: spec.template.includes("tiktok") || spec.template.includes("story"),
  })

  const response = new ImageResponse(element, {
    width: spec.width,
    height: spec.height,
  })
  const buffer = Buffer.from(await response.arrayBuffer())
  await writeFile(filePath, buffer)

  const publicUrl = socialAssetPublicPath(product.id, key)
  const relativePath = `generated/social/${product.id}/${SOCIAL_ASSET_TEMPLATE_VERSION}/${filename}`
  console.log("[social-asset-render]", {
    productId: product.id,
    key,
    publicUrl,
    bytes: buffer.length,
    hasImage: Boolean(imageSrc),
  })
  return { relativePath, publicUrl, bytes: buffer.length }
}
