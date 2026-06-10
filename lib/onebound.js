/**
 * OneBound 1688 item_get — import 1-clic produit fournisseur.
 * Docs: https://api-gw.onebound.cn (clé dans .env.local → ONEBOUND_KEY)
 */

const DEFAULT_ENDPOINT = "https://api-gw.onebound.cn/1688/item_get/"

function oneboundEndpoint() {
  return process.env.ONEBOUND_URL?.trim() || DEFAULT_ENDPOINT
}
const OFFER_ID_RE = /offer\/(\d+)\.html/

export function extract1688Id(url) {
  const match = OFFER_ID_RE.exec(String(url ?? ""))
  return match ? match[1] : null
}

function toNumber(value, fallback = 0) {
  const n = Number.parseFloat(String(value ?? ""))
  return Number.isFinite(n) ? n : fallback
}

function normalizeImages(item) {
  const images = []
  if (item.pic_url) images.push(String(item.pic_url))
  const extra = Array.isArray(item?.item_imgs) ? item.item_imgs : []
  for (const img of extra) {
    const u = typeof img === "string" ? img : img?.url
    if (u) images.push(String(u))
  }
  // dédoublonne + force https (1688 renvoie parfois //img.alicdn.com/…)
  return [...new Set(images)].map((u) => (u.startsWith("//") ? `https:${u}` : u))
}

function normalizeVariants(item) {
  const skus = Array.isArray(item?.skus?.sku) ? item.skus.sku : []
  return skus.map((sku) => ({
    name: String(sku?.properties_name ?? sku?.properties ?? "").trim() || "Default",
    price: toNumber(sku?.price, toNumber(item?.price)),
    stock: Math.max(0, Math.trunc(toNumber(sku?.quantity, 0))),
  }))
}

/**
 * Récupère un produit 1688 depuis son URL offre.
 * @param {string} url ex. https://detail.1688.com/offer/123456789.html
 * @returns {Promise<{name:string,description:string,price:number,images:string[],moq:number,variants:Array<{name:string,price:number,stock:number}>,supplier:string,source:string}>}
 */
export async function get1688(url) {
  const numIid = extract1688Id(url)
  if (!numIid) {
    throw new Error("URL 1688 invalide — attendu …/offer/<id>.html")
  }

  const key = process.env.ONEBOUND_KEY
  if (!key) {
    throw new Error("ONEBOUND_KEY manquante (.env.local)")
  }
  // La doc OneBound (open.onebound.cn) exige key + secret sur chaque appel
  const secret = process.env.ONEBOUND_SECRET
  if (!secret) {
    throw new Error(
      "ONEBOUND_SECRET manquante — copiez le apiSecret depuis votre console open.onebound.cn et ajoutez ONEBOUND_SECRET dans .env.local (+ Vercel)."
    )
  }
  const params = new URLSearchParams({ key, secret, num_iid: numIid })

  const apiUrl = `${oneboundEndpoint()}?${params.toString()}`

  const res = await fetch(apiUrl, { signal: AbortSignal.timeout(20_000) })
  if (!res.ok) {
    throw new Error(`OneBound HTTP ${res.status}`)
  }

  const data = await res.json()

  // OneBound signale les erreurs dans le corps (error / error_code / reason)
  if (data?.error || data?.error_code) {
    // 4005 = key/secret invalides (无权访问)
    if (String(data.error_code) === "4005") {
      throw new Error(
        "OneBound : clé ou secret invalide (erreur 4005). Vérifiez ONEBOUND_KEY et ONEBOUND_SECRET — les deux sont sur votre console open.onebound.cn."
      )
    }
    throw new Error(`OneBound: ${data.error || data.reason || data.error_code}`)
  }
  const item = data?.item
  if (!item) {
    throw new Error("OneBound: réponse sans item")
  }

  return {
    name: String(item.title ?? "").trim(),
    description: String(item.desc ?? item.desc_short ?? "").trim(),
    price: toNumber(item.price),
    images: normalizeImages(item),
    moq: Math.max(1, Math.trunc(toNumber(item.min_num, 1))),
    variants: normalizeVariants(item),
    supplier: String(item.seller_info?.shop_name ?? item.nick ?? "").trim(),
    source: `https://detail.1688.com/offer/${numIid}.html`,
  }
}
