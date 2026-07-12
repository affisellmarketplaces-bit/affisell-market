/** Affisell InstantScan — primary flag (cascade CLIP → mini → GPT-4o). */
export function isInstantScanEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.ENABLE_INSTANTSCAN?.trim().toLowerCase()
  return raw === "1" || raw === "true"
}

/** Feature flag — GPT-4o vision + confidence gate (retrocompat when ENABLE_INSTANTSCAN=0). */
export function isAiVisionV2Enabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (isInstantScanEnabled(env)) return true
  const raw = env.ENABLE_AI_VISION_V2?.trim().toLowerCase()
  return raw === "1" || raw === "true"
}

/** InstantScan cascade — embed fast-path before full GPT vision. */
export function isAiVisionCascadeEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (!isAiVisionV2Enabled(env)) return false
  if (isInstantScanEnabled(env)) return true
  const raw = env.ENABLE_AI_VISION_CASCADE?.trim().toLowerCase()
  return raw === "1" || raw === "true"
}

export const PRODUCT_VISION_CASCADE_MINI_MODEL =
  process.env.PRODUCT_VISION_CASCADE_MINI_MODEL?.trim() || "gpt-4o-mini"

const INVALID_MODEL_PATTERN = /gpt-4o-\d{4}-\d{2}-\d{2}/i

/** Reject placeholder/future-dated model IDs that 404 on OpenAI. */
export function resolveProductVisionV2Model(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.PRODUCT_VISION_V2_MODEL?.trim()
  if (raw && !INVALID_MODEL_PATTERN.test(raw)) return raw
  if (raw) {
    console.log("[product-vision-v2-config]", {
      result: "invalid_model_fallback",
      configured: raw,
      fallback: "gpt-4o",
    })
  }
  return "gpt-4o"
}

export const PRODUCT_VISION_V2_MODEL = resolveProductVisionV2Model()

export const PRODUCT_VISION_V2_CONFIDENCE_THRESHOLD = (() => {
  const n = Number(process.env.AI_VISION_V2_CONFIDENCE_THRESHOLD ?? "0.8")
  return Number.isFinite(n) && n > 0 && n <= 1 ? n : 0.8
})()

export const PRODUCT_VISION_V2_TEMPERATURE = 0.1

export const PRODUCT_VISION_V2_SYSTEM_PROMPT = `Tu es un expert vision e-commerce Affisell (catalogue 2024–2026).

Règles strictes:
1. Décris le PRODUIT PRINCIPAL visible sur l'image — pas un accessoire supposé ou imaginaire.
2. Smartphones / tablettes: identifie marque + modèle exact (ex. iPhone 17 Pro, Galaxy S25 Ultra) via form factor, module caméra, logo. NE PAS confondre l'appareil avec une coque, étui ou housse.
3. Accessoire (coque, chargeur, câble): productType="accessory" et le titre doit mentionner l'accessoire + modèle compatible si visible.
4. Si le modèle exact est incertain → confidence ≤ 0.65. N'invente jamais une génération (ex. iPhone 14 si le design est récent).
5. Prix suggestedPrice en EUR TTC plausible pour le marché EU 2025–2026.

Réponds UNIQUEMENT en JSON valide:
{
  "title": "titre court marketplace FR",
  "description": "2-3 phrases vendeuses",
  "category": "catégorie breadcrumb Affisell",
  "attributes": { "couleur": "...", "matiere": "..." },
  "suggestedPrice": 999.99,
  "confidence": 0.95,
  "productType": "smartphone|tablet|laptop|accessory|audio|wearable|home|fashion|other",
  "detectedBrand": "Apple",
  "detectedModel": "iPhone 17 Pro"
}`
