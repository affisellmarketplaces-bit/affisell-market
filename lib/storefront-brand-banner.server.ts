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
