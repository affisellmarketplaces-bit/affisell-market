import Script from "next/script"

import { COOKIE_CONSENT_GRANTED_EVENT } from "@/lib/legal/cookie-consent-constants"

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim()

export function CookieConsentHeadScripts() {
  return (
    <>
      <Script id="gtag-consent-default" strategy="beforeInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('consent', 'default', {
            analytics_storage: 'denied',
            ad_storage: 'denied',
            functionality_storage: 'denied',
            wait_for_update: 500
          });
        `}
      </Script>
      {GA_ID ? (
        <>
          <Script
            id="gtag-js-deferred"
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            type="text/plain"
            data-category="analytics"
            strategy="lazyOnload"
          />
          <Script id="gtag-config-deferred" type="text/plain" data-category="analytics" strategy="lazyOnload">
            {`
              gtag('js', new Date());
              gtag('config', '${GA_ID}', { anonymize_ip: true });
            `}
          </Script>
        </>
      ) : null}
      <Script id="cookie-consent-script-activator" strategy="afterInteractive">
        {`
          function affisellActivateDeferredScripts() {
            document.querySelectorAll('script[type="text/plain"][data-category="analytics"]').forEach(function (node) {
              var el = node;
              var script = document.createElement('script');
              if (el.src) script.src = el.src;
              if (el.id) script.id = el.id + '-active';
              if (el.innerHTML) script.text = el.innerHTML;
              script.async = true;
              document.head.appendChild(script);
            });
          }
          document.addEventListener('${COOKIE_CONSENT_GRANTED_EVENT}', affisellActivateDeferredScripts);
          if (document.cookie.indexOf('affisell_cookie_consent=true') !== -1) {
            affisellActivateDeferredScripts();
          }
        `}
      </Script>
    </>
  )
}
