import {
  AffisellApiError,
  checkSession,
  importAliExpress,
  importFromUrl,
  saveDraft,
} from "./api.js"
import { DEFAULT_API_BASE, loadSettings, saveSettings } from "./config.js"
import {
  detectPlatform,
  parseAliExpressProductId,
  platformLabel,
} from "./platform.js"

let cachedProduct: Record<string, unknown> | null = null

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

function showError(msg: string | null) {
  const el = $("error")
  if (!msg) {
    el.classList.add("hidden")
    el.textContent = ""
    return
  }
  el.textContent = msg
  el.classList.remove("hidden")
}

function setBusy(busy: boolean) {
  $("btnPreview").disabled = busy
  $("btnSave").disabled = busy || !cachedProduct
}

async function getActiveTabUrl(): Promise<string | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab?.url ?? null
}

async function init() {
  const settings = await loadSettings()
  $("apiBase").value = settings.apiBase || DEFAULT_API_BASE
  $("token").value = settings.token
  $("linkDash").href = `${settings.apiBase}/dashboard/supplier/extension`

  const tabUrl = await getActiveTabUrl()
  $("pageUrl").textContent = tabUrl ?? "Aucun onglet"
  const platform = tabUrl ? detectPlatform(tabUrl) : "unsupported"
  $("platform").textContent = platformLabel(platform)

  if (!settings.token) {
    $("status").textContent = "Jeton requis"
    return
  }

  const session = await checkSession(settings)
  $("status").textContent = session.ok
    ? `Connecté · ${session.email ?? "fournisseur"}`
    : "Jeton invalide ou expiré"
}

$("saveSettings").addEventListener("click", async () => {
  await saveSettings({
    apiBase: $("apiBase").value,
    token: $("token").value,
  })
  $("status").textContent = "Paramètres enregistrés"
  showError(null)
  await init()
})

$("btnPreview").addEventListener("click", async () => {
  showError(null)
  cachedProduct = null
  $("preview").classList.add("hidden")
  $("btnSave").disabled = true
  setBusy(true)

  try {
    const settings = await loadSettings()
    if (!settings.token) throw new Error("Collez le jeton depuis le dashboard Affisell.")

    const tabUrl = await getActiveTabUrl()
    if (!tabUrl) throw new Error("Ouvrez une page produit.")

    const platform = detectPlatform(tabUrl)

    if (platform === "aliexpress") {
      const productId = parseAliExpressProductId(tabUrl)
      if (!productId) throw new Error("ID AliExpress introuvable dans l’URL.")
      const { editUrl, productId: id } = await importAliExpress(settings, productId)
      $("status").textContent = "Brouillon AliExpress créé"
      $("previewTitle").textContent = `Produit #${productId}`
      $("previewPrice").textContent = ""
      $("previewMeta").textContent = `ID catalogue : ${id}`
      $("preview").classList.remove("hidden")
      chrome.tabs.create({ url: editUrl })
      return
    }

    if (platform === "unsupported") {
      throw new Error("Cette page n’est pas reconnue comme fiche produit.")
    }

    const { product, warnings } = await importFromUrl(settings, tabUrl)
    cachedProduct = product

    const title = typeof product.title === "string" ? product.title : "—"
    const price =
      typeof product.suggested_price === "number"
        ? product.suggested_price
        : typeof product.price === "number"
          ? product.price
          : 0
    const currency = typeof product.currency === "string" ? product.currency : "EUR"
    const imgCount = Array.isArray(product.images) ? product.images.length : 0

    $("previewTitle").textContent = title
    $("previewPrice").textContent = `${price.toFixed(2)} ${currency}`
    $("previewMeta").textContent = `${imgCount} image(s)${warnings?.length ? ` · ${warnings[0]}` : ""}`
    $("preview").classList.remove("hidden")
    $("btnSave").disabled = false
    $("status").textContent = "Prêt à enregistrer"
  } catch (e) {
    const msg =
      e instanceof AffisellApiError
        ? e.message
        : e instanceof Error
          ? e.message
          : "Erreur"
    showError(msg)
    $("status").textContent = "Erreur"
  } finally {
    setBusy(false)
  }
})

$("btnSave").addEventListener("click", async () => {
  if (!cachedProduct) return
  showError(null)
  setBusy(true)
  try {
    const settings = await loadSettings()
    const { editUrl, name } = await saveDraft(settings, cachedProduct)
    $("status").textContent = `Enregistré : ${name}`
    chrome.tabs.create({ url: editUrl })
  } catch (e) {
    showError(e instanceof Error ? e.message : "Erreur")
  } finally {
    setBusy(false)
  }
})

void init()
