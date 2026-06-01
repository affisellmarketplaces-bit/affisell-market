import { buildAeCaptureWindowName } from "@/lib/fulfillment/ae-capture-token"

const BOOKMARKLET_CORE = String.raw`
function pickSync(){
  if(window.__AER_DATA__)return window.__AER_DATA__;
  if(window.__INIT_DATA__)return window.__INIT_DATA__;
  try{if(window.runParams&&window.runParams.data)return window.runParams.data;}catch(e){}
  try{if(window.runParams)return window.runParams;}catch(e2){}
  return null;
}
function fromHtml(html){
  var marks=["window.__AER_DATA__ = ","window.__AER_DATA__=","window.__INIT_DATA__ = "];
  for(var mi=0;mi<marks.length;mi++){
    var idx=html.indexOf(marks[mi]);
    if(idx<0)continue;
    var start=idx+marks[mi].length;
    while(html[start]===" ")start++;
    if(html[start]!=="{")continue;
    var depth=0,j=start;
    for(;j<html.length;j++){
      var c=html[j];
      if(c==="{")depth++;
      else if(c==="}"){depth--;if(depth===0){j++;break;}}
    }
    try{return JSON.parse(html.slice(start,j));}catch(e){}
  }
  return null;
}
function parseCtxFromString(raw){
  if(!raw)return null;
  var m=raw.match(/^affisellAfc\\|([^|]+)\\|([^|]+)\\|(.+)$/);
  if(m)return {productId:m[1],sessionId:m[2],captureToken:m[3]};
  m=raw.match(/^affisellAfc\\|([^|]+)\\|(.+)$/);
  if(m)return {sessionId:m[1],captureToken:m[2]};
  return null;
}
function readCtx(EMBED){
  if(EMBED&&EMBED.sessionId)return EMBED;
  var fromName=parseCtxFromString(window.name||"");
  if(fromName&&fromName.sessionId)return fromName;
  var hash=(location.hash||"").replace(/^#/,"");
  try{hash=decodeURIComponent(hash);}catch(e){}
  var fromHash=parseCtxFromString(hash);
  if(fromHash&&fromHash.sessionId)return fromHash;
  if(hash.indexOf("affisellAfc|")===0)return parseCtxFromString(hash);
  return null;
}
function deliverOpener(ORIGIN,d,c,pid){
  if(!window.opener||window.opener.closed)return false;
  try{
    window.opener.postMessage({
      type:"AFFISELL_AE_CAPTURE",
      productId:pid,
      aeUrl:location.href.split("#")[0],
      aerData:d,
      sessionId:c.sessionId,
      captureToken:c.captureToken
    },ORIGIN);
    alert("\\u2705 Catalogue envoy\\u00e9 \\u00e0 Affisell ! Retournez sur l\\u2019onglet admin.");
    return true;
  }catch(e){return false;}
}
function postForm(ORIGIN,d,c,pid){
  try{
    var f=document.createElement("form");
    f.method="POST";
    f.action=ORIGIN+"/api/admin/products/"+pid+"/ae-capture";
    f.target="_blank";
    f.style.display="none";
    var inp=document.createElement("input");
    inp.name="payload";
    inp.value=JSON.stringify({
      sessionId:c.sessionId,
      captureToken:c.captureToken,
      aeUrl:location.href.split("#")[0],
      aerData:d
    });
    f.appendChild(inp);
    document.body.appendChild(f);
    f.submit();
    alert("\\u2705 Envoi Affisell (nouvel onglet). Revenez sur l\\u2019admin.");
    return true;
  }catch(e){return false;}
}
function postFetch(ORIGIN,d,c,pid){
  fetch(ORIGIN+"/api/admin/products/"+pid+"/ae-capture",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      sessionId:c.sessionId,
      captureToken:c.captureToken,
      aeUrl:location.href.split("#")[0],
      aerData:d
    })
  }).then(function(r){return r.json();}).then(function(j){
    if(j.ok){
      try{window.opener&&window.opener.postMessage({type:"AFFISELL_AE_CAPTURE_OK",productId:pid},ORIGIN);}catch(e){}
      alert("\\u2705 Catalogue import\\u00e9 ! Retournez sur Affisell.");
    }else alert(j.error||"Erreur import");
  }).catch(function(){alert("R\\u00e9seau bloqu\\u00e9 — utilisez le pont (Import Express ouvert depuis Affisell).");});
}
function deliver(ORIGIN,d,c,pid){
  if(deliverOpener(ORIGIN,d,c,pid))return;
  if(postForm(ORIGIN,d,c,pid))return;
  postFetch(ORIGIN,d,c,pid);
}
function run(ORIGIN,EMBED){
  var c=readCtx(EMBED);
  if(!c||!c.sessionId){alert("Lancez d\\u2019abord \\u00ab Import Express \\u00bb sur Affisell, puis recliquez ici.");return;}
  var pid=(c.productId||"").replace(/[^a-zA-Z0-9_-]/g,"");
  if(!pid){alert("Session invalide \\u2014 relancez Import Express.");return;}
  var d=pickSync();
  if(d){deliver(ORIGIN,d,c,pid);return;}
  fetch(location.href.split("#")[0],{credentials:"include"}).then(function(r){return r.text();}).then(function(html){
    var d2=fromHtml(html);
    if(!d2){alert("Catalogue AE introuvable. Attendez le chargement complet de la page.");return;}
    deliver(ORIGIN,d2,c,pid);
  }).catch(function(){alert("Impossible de lire la page AE.");});
}
`

function toBookmarkletHref(code: string): string {
  return `javascript:${encodeURIComponent(code)}`
}

/** Universal Affisell Import AE bookmarklet — one link for all products. */
export function buildUniversalAeImportBookmarklet(appOrigin: string): string {
  const origin = appOrigin.replace(/\/$/, "")
  const code = `(function(){var ORIGIN="${origin}";var EMBED=null;${BOOKMARKLET_CORE}run(ORIGIN,EMBED);})();`
  return toBookmarkletHref(code)
}

/** Session-scoped bookmarklet (works even if AliExpress clears window.name). */
export function buildSessionAeImportBookmarklet(
  appOrigin: string,
  productId: string,
  sessionId: string,
  captureToken: string
): string {
  const origin = appOrigin.replace(/\/$/, "")
  const safePid = productId.replace(/\\/g, "").replace(/"/g, "")
  const safeSid = sessionId.replace(/\\/g, "").replace(/"/g, "")
  const safeTok = captureToken.replace(/\\/g, "").replace(/"/g, "")
  const code = `(function(){var ORIGIN="${origin}";var EMBED={productId:"${safePid}",sessionId:"${safeSid}",captureToken:"${safeTok}"};${BOOKMARKLET_CORE}run(ORIGIN,EMBED);})();`
  return toBookmarkletHref(code)
}

/** Append capture context to AE URL (hash survives many SPA navigations). */
export function appendAeCaptureContextToUrl(
  aeUrl: string,
  productId: string,
  sessionId: string,
  captureToken: string
): string {
  const base = aeUrl.trim().split("#")[0] ?? aeUrl.trim()
  const ctx = buildAeCaptureWindowName(productId, sessionId, captureToken)
  return `${base}#${encodeURIComponent(ctx)}`
}

/** @deprecated Use buildUniversalAeImportBookmarklet */
export function buildAeImportBookmarklet(opts: {
  appOrigin: string
  productId: string
}): string {
  return buildUniversalAeImportBookmarklet(opts.appOrigin)
}

export function isAffisellAeCaptureMessage(
  data: unknown,
  productId: string
): data is {
  type: "AFFISELL_AE_CAPTURE"
  productId: string
  sessionId?: string
  captureToken?: string
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

export { parseAeCaptureWindowName } from "@/lib/fulfillment/ae-capture-token"
