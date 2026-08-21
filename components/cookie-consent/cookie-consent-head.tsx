import Script from "next/script"

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

/**
 * Server-only consent bootstrap — React 19 forbids raw `<script>` in component trees
 * that hydrate on the client. Use next/script + client activator for deferred GA.
 */
export function CookieConsentHeadScripts() {
  return (
    <Script id="gtag-consent-default" strategy="beforeInteractive">
      {GTAG_CONSENT_DEFAULT}
    </Script>
  )
}
