import { CookieConsentScriptActivator } from "@/components/cookie-consent/cookie-consent-script-activator"

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim()

const GTAG_CONSENT_DEFAULT = `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent', 'default', {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  functionality_storage: 'denied',
  wait_for_update: 500
});
`.trim()

/** Server-rendered consent + deferred GA placeholders (React 19 — native script, no next/script). */
export function CookieConsentHeadScripts() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: GTAG_CONSENT_DEFAULT }} />
      {GA_ID ? (
        <>
          <script
            id="gtag-js-deferred"
            type="text/plain"
            data-category="analytics"
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            async
          />
          <script
            id="gtag-config-deferred"
            type="text/plain"
            data-category="analytics"
            dangerouslySetInnerHTML={{
              __html: `
gtag('js', new Date());
gtag('config', '${GA_ID}', { anonymize_ip: true });
              `.trim(),
            }}
          />
        </>
      ) : null}
      <CookieConsentScriptActivator />
    </>
  )
}
