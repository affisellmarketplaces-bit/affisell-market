import { parseAeCaptureWindowName } from "@/lib/fulfillment/ae-capture-token"

/** Bookmarklet run on AliExpress — POST catalogue via signed token (no cookies). */
export function buildAeImportBookmarklet(opts: {
  appOrigin: string
  productId: string
}): string {
  const origin = opts.appOrigin.replace(/\/$/, "")
  const pid = opts.productId.replace(/[^a-zA-Z0-9_-]/g, "")
  const code = `(function(){
function pickData(){
  if(window.__AER_DATA__)return window.__AER_DATA__;
  if(window.__INIT_DATA__)return window.__INIT_DATA__;
  try{if(window.runParams&&window.runParams.data)return window.runParams.data;}catch(e){}
  return null;
}
var d=pickData();
if(!d){alert("Attendez le chargement complet de la page produit, puis recliquez le favori.");return;}
var parsed=(function(){
  var m=(window.name||"").match(/^affisellAfc\\|([^|]+)\\|(.+)$/);
  if(m)return {sessionId:m[1],captureToken:m[2]};
  var h=(location.hash.match(/afc=([^&]+)/)||[])[1];
  if(h)return {sessionId:decodeURIComponent(h),captureToken:""};
  return null;
})();
if(!parsed||!parsed.sessionId){
  alert("Relancez Import Express depuis Affisell (session perdue).");
  return;
}
fetch("${origin}/api/admin/products/${pid}/ae-capture",{
  method:"POST",
  headers:{"Content-Type":"application/json"},
  body:JSON.stringify({
    sessionId:parsed.sessionId,
    captureToken:parsed.captureToken,
    aeUrl:location.href.split("#")[0],
    aerData:d
  })
}).then(function(r){return r.json();}).then(function(j){
  if(j.ok){alert("\\u2705 Catalogue import\\u00e9 ! Retournez sur Affisell.");}
  else alert(j.error||"Erreur import Affisell");
}).catch(function(){alert("Erreur r\\u00e9seau — v\\u00e9rifiez votre connexion.");});
})();`
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

export { parseAeCaptureWindowName }
