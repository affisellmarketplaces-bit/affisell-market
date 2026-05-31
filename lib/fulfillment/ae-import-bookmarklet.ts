/** Minimal bookmarklet: reads __AER_DATA__ on AliExpress and sends it to Affisell admin. */
export function buildAeImportBookmarklet(opts: {
  appOrigin: string
  productId: string
}): string {
  const origin = opts.appOrigin.replace(/\/$/, "")
  const pid = opts.productId.replace(/[^a-zA-Z0-9_-]/g, "")
  const code = `(function(){var d=window.__AER_DATA__;if(!d){alert("Ouvrez une fiche produit AliExpress.");return;}var m={type:"AFFISELL_AE_CAPTURE",productId:"${pid}",aeUrl:location.href,aerData:d};if(window.opener&&!window.opener.closed){window.opener.postMessage(m,"${origin}");alert("\\u2705 Catalogue envoy\\u00e9 \\u00e0 Affisell !");return;}var f=document.createElement("form");f.method="POST";f.action="${origin}/api/admin/products/${pid}/ae-capture";f.target="_blank";var i=document.createElement("input");i.type="hidden";i.name="payload";i.value=JSON.stringify({aeUrl:location.href,aerData:d});f.appendChild(i);document.body.appendChild(f);f.submit();})();`
  return `javascript:${encodeURIComponent(code)}`
}

export function isAffisellAeCaptureMessage(
  data: unknown,
  productId: string
): data is {
  type: "AFFISELL_AE_CAPTURE"
  productId: string
  aeUrl: string
  aerData: unknown
} {
  if (!data || typeof data !== "object") return false
  const rec = data as Record<string, unknown>
  return (
    rec.type === "AFFISELL_AE_CAPTURE" &&
    rec.productId === productId &&
    typeof rec.aeUrl === "string" &&
    rec.aerData !== undefined &&
    rec.aerData !== null
  )
}

export function isAliExpressOrigin(origin: string): boolean {
  try {
    return /\.aliexpress\.com$/i.test(new URL(origin).hostname)
  } catch {
    return false
  }
}
