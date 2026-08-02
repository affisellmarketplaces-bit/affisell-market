import { timingSafeEqual } from "node:crypto"

import { NextResponse } from "next/server"

import { readAliExpressConfig } from "@/lib/aliexpress-config"
import {
  DEFAULT_ALIEXPRESS_OAUTH_REDIRECT_URI,
  buildAliExpressAuthorizeUrl,
  exchangeAliExpressAuthorizationCode,
  resolveAliExpressOAuthRedirectUri,
  summarizeAliExpressTokens,
} from "@/lib/aliexpress-oauth-token-exchange"
import { mustEnforceProductionSecrets } from "@/lib/require-production-secret"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function wantsJson(req: Request): boolean {
  const url = new URL(req.url)
  if (url.searchParams.get("format") === "json") return true
  const accept = req.headers.get("accept") ?? ""
  return accept.includes("application/json") && !accept.includes("text/html")
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

/** Reveal plaintext tokens only with setup/cron secret (or local non-prod). */
function canRevealAliExpressTokens(req: Request): boolean {
  const setup =
    process.env.ALIEXPRESS_OAUTH_SETUP_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    ""
  if (!setup) {
    return !mustEnforceProductionSecrets()
  }
  const url = new URL(req.url)
  const q =
    url.searchParams.get("setup_secret")?.trim() ||
    url.searchParams.get("secret")?.trim() ||
    ""
  if (q && safeEqual(q, setup)) return true
  const header =
    req.headers.get("x-aliexpress-setup-secret")?.trim() ||
    req.headers.get("x-cron-secret")?.trim() ||
    ""
  return Boolean(header && safeEqual(header, setup))
}

function maskTail(token: string): string {
  if (!token) return "(empty)"
  if (token.length <= 4) return "****"
  return `…${token.slice(-4)}`
}

function htmlPage(title: string, body: string, ok: boolean): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, sans-serif; }
    body { margin: 0; padding: 2rem 1.25rem; background: #0b0b0f; color: #f4f4f5; }
    main { max-width: 42rem; margin: 0 auto; }
    h1 { font-size: 1.35rem; letter-spacing: -0.02em; margin: 0 0 0.5rem; }
    .sub { color: #a1a1aa; font-size: 0.9rem; line-height: 1.5; margin-bottom: 1.25rem; }
    .card { border: 1px solid ${ok ? "#166534" : "#7f1d1d"}; background: ${ok ? "#052e16" : "#450a0a"}; border-radius: 1rem; padding: 1rem 1.1rem; }
    label { display: block; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #a1a1aa; margin: 0.85rem 0 0.35rem; }
    textarea, pre { width: 100%; box-sizing: border-box; border-radius: 0.75rem; border: 1px solid #3f3f46; background: #09090b; color: #fafafa; padding: 0.75rem; font: 0.8rem/1.45 ui-monospace, SFMono-Regular, Menlo, monospace; resize: vertical; }
    textarea { min-height: 4.5rem; }
    .hint { margin-top: 1rem; font-size: 0.8rem; color: #d4d4d8; line-height: 1.45; }
    a { color: #c4b5fd; }
    .btn { display: inline-flex; margin-top: 0.75rem; margin-right: 0.5rem; padding: 0.55rem 0.9rem; border-radius: 999px; background: #fafafa; color: #09090b; font-weight: 600; font-size: 0.85rem; text-decoration: none; border: 0; cursor: pointer; }
    .btn-muted { background: #27272a; color: #fafafa; }
    .hidden { display: none !important; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    ${body}
  </main>
  <script>
    function copyField(id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.select();
      navigator.clipboard?.writeText(el.value);
    }
    function hideTokens() {
      document.getElementById('token-panel')?.classList.add('hidden');
      document.getElementById('tokens-hidden-msg')?.classList.remove('hidden');
    }
  </script>
</body>
</html>`
  return new NextResponse(html, {
    status: ok ? 200 : 400,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  })
}

/**
 * GET /api/aliexpress/oauth/callback?code=
 * AliExpress redirects here after seller authorize. Exchanges code → tokens.
 * Plaintext tokens only with ?setup_secret= / CRON_SECRET (or local non-prod).
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")?.trim() ?? ""
  const aeError = url.searchParams.get("error")?.trim()
  const aeErrorDesc = url.searchParams.get("error_description")?.trim()
  const redirectUri = resolveAliExpressOAuthRedirectUri()
  const config = readAliExpressConfig()
  const jsonMode = wantsJson(req)
  const reveal = canRevealAliExpressTokens(req)

  if (aeError) {
    const payload = {
      ok: false as const,
      error: aeError,
      error_description: aeErrorDesc ?? null,
      redirect_uri: redirectUri,
    }
    console.log("[aliexpress-oauth]", { result: "ae_denied", error: aeError })
    if (jsonMode) return NextResponse.json(payload, { status: 400 })
    return htmlPage(
      "AliExpress OAuth refusé",
      `<p class="sub">${escapeHtml(aeErrorDesc || aeError)}</p>
       <div class="card"><pre>${escapeHtml(JSON.stringify(payload, null, 2))}</pre></div>`,
      false
    )
  }

  if (!code) {
    const authorizeUrl = config.appKey ? buildAliExpressAuthorizeUrl(config.appKey, redirectUri) : null
    const payload = {
      ok: false as const,
      error: "missing_code",
      message:
        "Ajoute ?code=… (retour AliExpress) ou démarre le flow OAuth via l’URL d’autorisation.",
      redirect_uri: redirectUri,
      expected_redirect_uri: DEFAULT_ALIEXPRESS_OAUTH_REDIRECT_URI,
      authorize_url: authorizeUrl,
    }
    console.log("[aliexpress-oauth]", { result: "missing_code", redirectUri })
    if (jsonMode) return NextResponse.json(payload, { status: 400 })
    return htmlPage(
      "AliExpress OAuth — callback",
      `<p class="sub">Redirect URI enregistré : <code>${escapeHtml(redirectUri)}</code></p>
       <div class="card">
         <p>Aucun <code>code</code> dans l’URL. Relance l’autorisation AliExpress.</p>
         ${
           authorizeUrl
             ? `<p><a class="btn" href="${escapeHtml(authorizeUrl)}">Autoriser AliExpress</a></p>`
             : `<p class="hint">Configure <code>ALIEXPRESS_APP_KEY</code> / <code>ALIEXPRESS_APP_SECRET</code> sur Vercel.</p>`
         }
       </div>`,
      false
    )
  }

  const exchanged = await exchangeAliExpressAuthorizationCode({
    code,
    clientId: config.appKey,
    clientSecret: config.appSecret,
    redirectUri,
  })

  if (!exchanged.ok) {
    console.log("[aliexpress-oauth]", {
      result: "exchange_failed",
      error: exchanged.error,
      httpStatus: exchanged.httpStatus,
      redirectUri,
      attempts: exchanged.attempts.map((a) => ({
        method: a.method,
        httpStatus: a.httpStatus,
        bodyText: a.bodyText.slice(0, 1500),
      })),
    })
    const payload = {
      ok: false as const,
      error: exchanged.error,
      httpStatus: exchanged.httpStatus,
      redirect_uri: redirectUri,
      bodyText: exchanged.bodyText,
      aliexpress: exchanged.body,
      attempts: exchanged.attempts.map((a) => ({
        method: a.method,
        url: a.url,
        httpStatus: a.httpStatus,
        bodyText: a.bodyText,
        body: a.body,
      })),
    }
    if (jsonMode) {
      return NextResponse.json(payload, {
        status: exchanged.httpStatus >= 400 ? exchanged.httpStatus : 400,
      })
    }
    return htmlPage(
      "Échange token AliExpress échoué",
      `<p class="sub">${escapeHtml(exchanged.error)}</p>
       <div class="card">
         <label>Réponse AliExpress (texte)</label>
         <pre>${escapeHtml(exchanged.bodyText || "(vide)")}</pre>
         <label>Détail / tentatives</label>
         <pre>${escapeHtml(JSON.stringify(payload, null, 2))}</pre>
       </div>
       <p class="hint">Vérifie que le redirect_uri est EXACTEMENT<br/><code>${escapeHtml(DEFAULT_ALIEXPRESS_OAUTH_REDIRECT_URI)}</code><br/>et que le code OAuth a moins de ~10 minutes. Relance un nouveau flow OAuth après ce fix.</p>`,
      false
    )
  }

  const { tokens } = exchanged
  const persisted = exchanged.persisted === true
  console.log("[aliexpress-oauth]", {
    result: "ok",
    redirectUri,
    reveal,
    persisted,
    ...summarizeAliExpressTokens(tokens),
  })

  const safeMeta = {
    expires_in: tokens.expires_in,
    refresh_expires_in: tokens.refresh_expires_in,
    account: tokens.account,
    seller_id: tokens.seller_id,
    user_id: tokens.user_id,
    redirect_uri: redirectUri,
    persisted,
    access_token_tail: maskTail(tokens.access_token),
    refresh_token_tail: maskTail(tokens.refresh_token),
  }

  if (jsonMode) {
    if (!reveal) {
      return NextResponse.json(
        { ok: true, ...safeMeta, message: "Tokens persisted; pass setup_secret to reveal plaintext" },
        { headers: { "Cache-Control": "no-store" } }
      )
    }
    return NextResponse.json(
      {
        ok: true,
        ...safeMeta,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        env_hint: {
          ALIEXPRESS_ACCESS_TOKEN: tokens.access_token,
          ALIEXPRESS_REFRESH_TOKEN: tokens.refresh_token,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  }

  if (!reveal) {
    return htmlPage(
      "Tokens AliExpress enregistrés",
      `<p class="sub">Échange OK. Tokens masqués sur cette page (callback public AliExpress).</p>
       <div class="card">
         <pre>${escapeHtml(JSON.stringify(safeMeta, null, 2))}</pre>
         <p class="hint">
           ${
             persisted
               ? "Persistance DB chiffrée OK — le cron <code>/api/cron/aliexpress-refresh</code> renouvellera automatiquement."
               : "Persistance DB échouée (ENCRYPTION_KEY ?). Relance avec <code>?setup_secret=CRON_SECRET</code> pour copier vers Vercel env."
           }
         </p>
       </div>
       <p class="hint">Pour afficher les tokens en clair : ajoute <code>?setup_secret=…</code> (ALIEXPRESS_OAUTH_SETUP_SECRET ou CRON_SECRET).</p>`,
      true
    )
  }

  return htmlPage(
    "Tokens AliExpress prêts",
    `<p class="sub">Copie dans Vercel si besoin, puis masque. Ne partage pas cette URL.</p>
     <div class="card" id="token-panel">
       <label for="access">ALIEXPRESS_ACCESS_TOKEN</label>
       <textarea id="access" readonly>${escapeHtml(tokens.access_token)}</textarea>
       <button type="button" class="btn" onclick="copyField('access')">Copier access_token</button>
       <label for="refresh">ALIEXPRESS_REFRESH_TOKEN</label>
       <textarea id="refresh" readonly>${escapeHtml(tokens.refresh_token || "(absent)")}</textarea>
       <button type="button" class="btn" onclick="copyField('refresh')">Copier refresh_token</button>
       <button type="button" class="btn btn-muted" onclick="hideTokens()">Masquer après copie</button>
       <label>Meta</label>
       <pre>${escapeHtml(JSON.stringify(safeMeta, null, 2))}</pre>
     </div>
     <p id="tokens-hidden-msg" class="hint hidden">Tokens masqués dans le DOM. Recharge avec setup_secret si besoin.</p>
     <p class="hint">Redirect URI : <code>${escapeHtml(redirectUri)}</code> · persisted=${persisted}</p>`,
    true
  )
}
