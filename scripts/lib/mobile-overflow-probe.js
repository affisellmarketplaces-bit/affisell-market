/**
 * Browser-side half of the mobile overflow audit. Plain browser JS, no imports, so it can be injected by
 * `scripts/audit-mobile-overflow.mjs` (Playwright) *or* pasted by hand in the console of an already signed-in browser.
 *
 *   __mobileProbe.stress("hinted")   // optional: swap data-like text for worst-case long strings first
 *   __mobileProbe.audit()            // → { vw, shellOverflowPx, roots: [{ tag, cls, text, left, right, stressed }] }
 */
;(() => {
  /** An unbreakable product-title-like token and an e-mail-like token: the two shapes user data takes in practice. */
  const LONG_TOKEN = "Chaussettes-de-compression-professionnelles-anti-fatigue-pour-voyage-long-courrier-XXL"
  const LONG_EMAIL = "prenom.nom.avec-un-tres-long-identifiant@sous-domaine-entreprise-internationale.example.com"

  /** Classes that say "the author expects variable-length data here". */
  const DATA_HINT = /(?:^|\s)(?:truncate|text-ellipsis|line-clamp-\d|break-words|break-all|min-w-0)(?:\s|$)/
  const CHROME = "header, footer, nav, [role='navigation'], [role='tablist'], [role='dialog'], [aria-hidden='true']"
  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "SVG", "INPUT", "SELECT", "TEXTAREA", "OPTION", "OPTGROUP", "LABEL"])
  const NUMERIC = /^[\d\s.,:€$£%+\-–/()]+$/

  function looksLikeData(el, mode) {
    if (mode === "all") return el.tagName !== "BUTTON"
    for (let n = el, i = 0; n && i < 4; n = n.parentElement, i += 1) {
      if (DATA_HINT.test(String(n.className ?? ""))) return true
    }
    return false
  }

  /**
   * Replaces the text of leaf elements with a worst-case long string, marking each with `data-mo-stressed`.
   * "hinted" (default): only elements the code already treats as variable-length (truncate / clamp / break-words /
   * min-w-0). "all": every leaf of 8+ characters — noisy by design, UI copy is not expected to survive it.
   * Page chrome (header, nav, footer, dialogs) and form controls are left alone.
   */
  function stress(mode = "hinted") {
    const root = document.querySelector("main") ?? document.querySelector(".affisell-page-shell") ?? document.body
    let count = 0
    for (const el of root.querySelectorAll("*")) {
      if (el.children.length > 0 || SKIP_TAGS.has(el.tagName.toUpperCase()) || el.closest(CHROME)) continue
      const text = (el.textContent ?? "").trim()
      if (text.length < (mode === "all" ? 8 : 3) || NUMERIC.test(text)) continue
      if (!looksLikeData(el, mode)) continue
      el.textContent = text.includes("@") ? LONG_EMAIL : LONG_TOKEN
      el.setAttribute("data-mo-stressed", "1")
      count += 1
    }
    return count
  }

  /**
   * Elements that stick out of the screen without a scroller/clipping box that fits around them. html, body and
   * the page shell clip the x axis for everything, so they must not count as containment — that is exactly the
   * failure being hunted. Returns root offenders only (an offender whose parent is not itself one).
   */
  function audit() {
    const vw = document.documentElement.clientWidth
    const isPageWrapper = (a) =>
      a === document.body || a === document.documentElement || a.classList.contains("affisell-page-shell")
    const containsOverflow = (el) => {
      for (let a = el.parentElement; a; a = a.parentElement) {
        if (isPageWrapper(a) || getComputedStyle(a).overflowX === "visible") continue
        const r = a.getBoundingClientRect()
        if (r.left >= -1 && r.right <= vw + 1) return true
      }
      return false
    }

    const offenders = new Set()
    for (const el of document.body.querySelectorAll("*")) {
      const cs = getComputedStyle(el)
      if (cs.position === "fixed" || cs.display === "none" || cs.visibility === "hidden") continue
      if (el.closest("[aria-hidden='true'], svg")) continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      if (r.right <= vw + 1 && r.left >= -1) continue
      if (containsOverflow(el)) continue
      offenders.add(el)
    }

    const roots = [...offenders].filter((el) => !offenders.has(el.parentElement))
    const shell = document.querySelector(".affisell-page-shell")
    return {
      vw,
      shellOverflowPx: shell ? shell.scrollWidth - shell.clientWidth : null,
      roots: roots.slice(0, 8).map((el) => {
        const r = el.getBoundingClientRect()
        return {
          tag: el.tagName.toLowerCase(),
          cls: String(el.className ?? "").slice(0, 120),
          text: (el.textContent ?? "").trim().slice(0, 40),
          left: Math.round(r.left),
          right: Math.round(r.right),
          stressed: el.hasAttribute("data-mo-stressed") || el.querySelector("[data-mo-stressed]") !== null,
        }
      }),
    }
  }

  window.__mobileProbe = { audit, stress }
})()
