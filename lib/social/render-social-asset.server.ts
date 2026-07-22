import "server-only"

import { mkdir, writeFile, access } from "node:fs/promises"
import path from "node:path"

import { ImageResponse } from "next/og"

import { pickTemplateElement } from "@/components/social/templates/BubbleSocialTemplates"
import type { BubbleProductView } from "@/lib/social/bubble-product-types"
import { SOCIAL_ASSET_DIMENSIONS, type SocialAssetKey } from "@/lib/social/bubble-product-types"

function generatedDir(productId: string): string {
  return path.join(process.cwd(), "public", "generated", "social", productId)
}

export function socialAssetPublicPath(productId: string, key: SocialAssetKey): string {
  return `/generated/social/${productId}/${key}.png`
}

export async function socialAssetFileExists(productId: string, key: SocialAssetKey): Promise<boolean> {
  try {
    await access(path.join(generatedDir(productId), `${key}.png`))
    return true
  } catch {
    return false
  }
}

export async function renderSocialAssetPng(
  product: BubbleProductView,
  key: SocialAssetKey
): Promise<{ relativePath: string; publicUrl: string }> {
  const spec = SOCIAL_ASSET_DIMENSIONS[key]
  const dir = generatedDir(product.id)
  await mkdir(dir, { recursive: true })
  const filename = `${key}.png`
  const filePath = path.join(dir, filename)

  const element = pickTemplateElement({
    product,
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

  const relativePath = `generated/social/${product.id}/${filename}`
  const publicUrl = `/${relativePath}`
  console.log("[social-asset-render]", { productId: product.id, key, publicUrl })
  return { relativePath, publicUrl }
}
