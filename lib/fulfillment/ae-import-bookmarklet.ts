/** Universal Affisell Import AE bookmarklet — one link for all products. */
export function buildUniversalAeImportBookmarklet(appOrigin: string): string {
  const origin = appOrigin.replace(/\/$/, "")
  const code = `(function(){
var ORIGIN="${origin}";
function ctx(){
  var m=(window.name||"").match(/^affisellAfc\\|([^|]+)\\|([^|]+)\\|(.+)$/);
  if(m)return {productId:m[1],sessionId:m[2],captureToken:m[3]};
  m=(window.name||"").match(/^affisellAfc\\|([^|]+)\\|(.+)$/);
  if(m)return {sessionId:m[1],captureToken:m[2]};
  return null;
}
function pickSync(){
  if(window.__AER_DATA__)return window.__AER_DATA__;
  if(window.__INIT_DATA__)return window.__INIT_DATA__;
  try{if(window.runParams&&window.runParams.data)return window.runParams.data;}catch(e){}
  return null;
}
function fromHtml(html){
  var marks=["window.__AER_DATA__ = ","window.__AER_DATA__="];
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
function post(d,c,pid){
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
    if(j.ok){alert("\\u2705 Catalogue import\\u00e9 ! Retournez sur Affisell.");}
    else alert(j.error||"Erreur import (code "+(j.error||"unknown")+")");
  }).catch(function(){alert("Erreur r\\u00e9seau Affisell.");});
}
var c=ctx();
if(!c||!c.sessionId){alert("Cliquez d\\u2019abord \\u00ab Lancer import express \\u00bb sur Affisell.");return;}
var pid=(c.productId||"").replace(/[^a-zA-Z0-9_-]/g,"");
if(!pid){alert("Session Affisell invalide \\u2014 relancez Import Express.");return;}
var d=pickSync();
if(d){post(d,c,pid);return;}
fetch(location.href,{credentials:"include"}).then(function(r){return r.text();}).then(function(html){
  var d2=fromHtml(html);
  if(!d2){alert("Catalogue AE introuvable. Attendez le chargement complet puis r\\u00e9essayez.");return;}
  post(d2,c,pid);
}).catch(function(){alert("Impossible de lire la page AE.");});
})();`
  return `javascript:${encodeURIComponent(code)}`
}

/** @deprecated Use buildUniversalAeImportBookmarklet — kept for product panel compat */
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

export { parseAeCaptureWindowName } from "@/lib/fulfillment/ae-capture-token"
