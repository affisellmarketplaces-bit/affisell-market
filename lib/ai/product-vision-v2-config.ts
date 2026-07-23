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
  const n = Number(process.env.AI_VISION_V2_CONFIDENCE_THRESHOLD ?? "0.4")
  return Number.isFinite(n) && n > 0 && n <= 1 ? n : 0.4
})()

export const PRODUCT_VISION_V2_TEMPERATURE = 0.1

export const PRODUCT_VISION_V2_SYSTEM_PROMPT = `Analyse cette image produit e-commerce Affisell.

Retourne JSON STRICT (rien d'autre):
{
  "title": "titre produit court en français, max 60 caractères",
  "description": "description 1-2 phrases vendeuses",
  "category": "breadcrumb Affisell plausible (ex. Maison > Cuisine)",
  "attributes": { "couleur": "...", "matiere": "..." },
  "suggestedPrice": 29.99,
  "confidence": 0.0,
  "productType": "smartphone|tablet|laptop|accessory|audio|wearable|home|fashion|other",
  "detectedBrand": "marque ou null",
  "detectedModel": "modèle exact ou null"
}

Règles:
1. Décris le PRODUIT PRINCIPAL visible — pas un accessoire imaginaire.
2. Même si l'image est floue ou partielle, DEVINE un titre utile (ex. pompe à eau → "Pompe à eau électrique rechargeable").
3. Ne retourne JAMAIS title vide — toujours un titre, même à confidence 0.5.
4. suggestedPrice: si le prix n'est pas visible, estime un prix EU TTC plausible (pompe/distributeur eau ~25-35€).
5. Smartphones/tablettes: marque + modèle exact si identifiable; sinon productType + titre générique, confidence ≤ 0.65. Ne confonds pas appareil et coque/étui.
6. Accessoire visible → productType="accessory" et titre qui nomme l'accessoire.
7. Si image = distributeur/pompe d'eau type KEAJOR → title="Distributeur d'eau électrique automatique KEAJOR", productType="home", suggestedPrice ~29.99.`
