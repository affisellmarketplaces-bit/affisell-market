import Script from "next/script"

const DEV_CSS_READY_SCRIPT = `(function(){var r=document.documentElement;r.classList.add("affisell-dev-pending");function go(){r.classList.add("affisell-dev-ready")}if(document.readyState==="complete")go();else window.addEventListener("load",go,{once:true});setTimeout(go,60000)})();`

/** Dev-only: hide unstyled HTML flash while webpack compiles the first CSS chunk. */
export function DevCssReady() {
  if (process.env.NODE_ENV !== "development") return null

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html:
            "html.affisell-dev-pending:not(.affisell-dev-ready) body{visibility:hidden;background:#fafafc}",
        }}
      />
      <Script id="affisell-dev-css-ready" strategy="beforeInteractive">
        {DEV_CSS_READY_SCRIPT}
      </Script>
    </>
  )
}
