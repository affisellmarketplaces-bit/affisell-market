/** gtag consent default — injected via DOM only (React 19: no <script> in component tree). */
export const GTAG_CONSENT_DEFAULT_SCRIPT = `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent', 'default', {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  functionality_storage: 'denied',
  wait_for_update: 500
});
`.trim()

export const GTAG_CONSENT_SCRIPT_ID = "gtag-consent-default"

/** Idempotent head injection — safe before interactive GA load. */
export function injectGtagConsentDefault(): void {
  if (typeof document === "undefined") return
  if (document.getElementById(GTAG_CONSENT_SCRIPT_ID)) return

  const script = document.createElement("script")
  script.id = GTAG_CONSENT_SCRIPT_ID
  script.text = GTAG_CONSENT_DEFAULT_SCRIPT
  document.head.insertBefore(script, document.head.firstChild)
}
