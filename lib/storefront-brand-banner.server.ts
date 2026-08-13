import { generateImageWithHf } from "@/lib/ai/hf-image"
import {
  isBrandLaunchNiche,
  type BrandLaunchNiche,
} from "@/lib/storefront-brand-launch"

const NICHE_MOOD: Record<BrandLaunchNiche, string> = {
  fashion: "editorial fashion lifestyle, soft fabric textures, runway mood",
  tech: "sleek gadgets, cyber minimalism, cool blue highlights",
  fitness: "dynamic wellness energy, athletic motion blur, fresh greens",
  beauty: "skincare glow, soft petals, premium spa atmosphere",
}

export function buildStoreBrandBannerPrompt(args: {
  storeName: string
  description?: string
  primary: string
  accent: string
  niche?: string
}): string {
  const storeName = args.storeName.trim().slice(0, 80) || "Store"
  const niche: BrandLaunchNiche =
    args.niche && isBrandLaunchNiche(args.niche) ? args.niche : "fashion"
  const tagline = args.description?.trim().slice(0, 120) ?? ""
  const mood = NICHE_MOOD[niche]

  return [
    "Wide cinematic ecommerce hero banner background, 16:9 landscape composition.",
    `Brand mood: ${mood}.`,
    tagline ? `Context (do not render as text): ${tagline}.` : "",
    `Color palette gradient from ${args.primary} to ${args.accent}.`,
    "Abstract premium marketplace aesthetic, soft lighting, depth of field.",
    "No readable text, no logos, no watermarks, no faces, no trademarked brands.",
    `Inspired by ${storeName} niche storefront — photorealistic digital art.`,
  ]
    .filter(Boolean)
    .join(" ")
}

export async function generateStoreBrandBannerImage(
  prompt: string
): Promise<Buffer | null> {
  if (!process.env.HF_TOKEN?.trim()) return null
  return generateImageWithHf(prompt.slice(0, 2000))
}

/** Local SVG mesh hero — always available when HF is down or unconfigured. */
export function buildGradientBannerSvg(args: {
  storeName: string
  primary: string
  accent: string
}): Buffer {
  const name = args.storeName.trim().slice(0, 48) || "Store"
  const primary = args.primary.trim() || "#5b21b6"
  const accent = args.accent.trim() || "#06b6d4"

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <defs>
    <linearGradient id="bg" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${primary}"/>
      <stop offset="48%" stop-color="${primary}" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="${accent}"/>
    </linearGradient>
    <radialGradient id="glow1" cx="18%" cy="78%" r="55%">
      <stop offset="0%" stop-color="${primary}" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="${primary}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="88%" cy="12%" r="48%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <filter id="blur" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="48"/>
    </filter>
  </defs>
  <rect width="1920" height="1080" fill="url(#bg)"/>
  <ellipse cx="340" cy="860" rx="520" ry="380" fill="url(#glow1)" filter="url(#blur)" opacity="0.55"/>
  <ellipse cx="1580" cy="180" rx="460" ry="340" fill="url(#glow2)" filter="url(#blur)" opacity="0.5"/>
  <text x="96" y="980" fill="rgba(255,255,255,0.18)" font-family="system-ui,sans-serif" font-size="28" font-weight="600">${name}</text>
</svg>`

  return Buffer.from(svg, "utf-8")
}
