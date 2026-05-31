/** Minimal bookmarklet: reads AE page JSON and POSTs to Affisell (works without window.opener). */
export function buildAeImportBookmarklet(opts: {
  appOrigin: string
  productId: string
}): string {
  const origin = opts.appOrigin.replace(/\/$/, "")
  const pid = opts.productId.replace(/[^a-zA-Z0-9_-]/g, "")
  const code = `(function(){function g(){if(window.__AER_DATA__)return window.__AER_DATA__;if(window.__INIT_DATA__)return window.__INIT_DATA__;try{if(window.runParams&&window.runParams.data)return window.runParams.data;}catch(e){}return null;}var d=g();if(!d){alert("Attendez le chargement complet de la page produit, puis recliquez le favori.");return;}var sid=(location.hash.match(/afc=([^&]+)/)||[])[1]||"";var m={type:"AFFISELL_AE_CAPTURE",productId:"${pid}",sessionId:sid,aeUrl:location.href,aerData:d};var sent=false;var t=[window.opener];try{if(window.opener&&window.opener.opener)t.push(window.opener.opener);}catch(e){}for(var i=0;i<t.length;i++){try{if(t[i]&&!t[i].closed){t[i].postMessage(m,"${origin}");sent=true;}}catch(e){}}fetch("${origin}/api/admin/products/${pid}/ae-capture",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:sid,aeUrl:location.href,aerData:d})}).then(function(r){return r.json();}).then(function(j){if(j.ok){alert("\\u2705 Catalogue import\\u00e9 ! Retournez sur Affisell.");}else if(!sent)alert(j.error||"Erreur import");}).catch(function(){if(!sent)alert("Erreur r\\u00e9seau \\u2014 reconnectez-vous \\u00e0 Affisell admin.");});})();`
  return `javascript:${encodeURIComponent(code)}`
}

export function isAffisellAeCaptureMessage(
  data: unknown,
  productId: string
): data is {
  type: "AFFISELL_AE_CAPTURE"
  productId: string
  sessionId?: string
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

export function appendAeCaptureHash(aeUrl: string, sessionId: string): string {
  const base = aeUrl.trim().split("#")[0] ?? aeUrl.trim()
  return `${base}#afc=${encodeURIComponent(sessionId)}`
}
