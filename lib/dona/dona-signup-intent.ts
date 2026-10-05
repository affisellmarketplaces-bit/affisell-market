/**
 * Does the visitor's message ask for help creating an account, and for which role? (pure, no I/O)
 *
 * The LLM's wording and link are best-effort; a sign-up request is too important to leave to it. The widget uses this
 * to attach a deterministic call-to-action (real buttons, correct destinations) under Dona's answer.
 * Conservative on purpose: a role word ("supplier"…) or an explicit account/sign-up phrase is required — a bare
 * "vendre" is ambiguous and never triggers it.
 */

export type DonaSignupIntent = "supplier" | "reseller" | "any"

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
}

// Role words, one list per role, across the 8 UI languages (accents stripped before matching).
const SUPPLIER_WORDS = [
  "fournisseur", "supplier", "grossiste", "wholesaler", "producteur", "producer", "manufacturer", "fabricant",
  "lieferant", "proveedor", "fornitore", "leverancier", "dostawca", "dostawc", "供应商", "供货商",
]
const RESELLER_WORDS = [
  "revendeur", "reseller", "affilie", "affiliate", "createur", "creator", "curateur", "curator",
  "wiederverkaufer", "partner-programm", "revendedor", "rivenditore", "wederverkoper", "odsprzedawc", "分销", "经销", "代理",
]

// "Create an account / sign up / become" — verbs and nouns, same languages.
const SIGNUP_PHRASES = [
  "inscri", "devenir", "creer un compte", "creer mon compte", "ouvrir un compte", "ouvrir mon compte", "enregistr",
  "sign up", "signup", "sign-up", "register", "registration", "become", "join ", "create an account", "create my account", "open an account",
  "anmeld", "registrier", "konto erstellen", "werden",
  "registrar", "registro", "crear cuenta", "crear una cuenta", "convertirme", "unirme",
  "registrare", "iscriv", "diventare", "creare un account", "creare account",
  "registreer", "aanmeld", "account aanmaken", "worden", "hoe word",
  "zarejestr", "rejestracj", "zalozyc konto", "zostac",
  "注册", "成为", "加入", "开通",
]
// Accent-stripped lowercase handles Latin scripts; CJK has no case/accents so those entries match as-is.

function hasAny(haystack: string, needles: readonly string[]): boolean {
  return needles.some((n) => haystack.includes(normalize(n)))
}

export function detectDonaSignupIntent(message: string | null | undefined): DonaSignupIntent | null {
  const text = normalize(message ?? "")
  if (text.trim().length < 3 || text.length > 600) return null

  const supplier = hasAny(text, SUPPLIER_WORDS)
  const reseller = hasAny(text, RESELLER_WORDS)
  const wantsSignup = hasAny(text, SIGNUP_PHRASES)

  if (!wantsSignup) return null
  if (supplier && !reseller) return "supplier"
  if (reseller && !supplier) return "reseller"
  // Both named ("fournisseur ou revendeur ?") or a generic "je veux m'inscrire sur Affisell": offer every door.
  if (supplier && reseller) return "any"
  return /\b(affisell|compte|account|konto|cuenta|conto|rekening|konto)\b|\bme\s+inscrire\b|\bsign\s*up\b|\bregister\b/.test(text)
    ? "any"
    : null
}

export type DonaSignupCtaPlacement = {
  intent: DonaSignupIntent
  /** Index (in the given list) of the assistant reply the CTA goes under; null = no reply yet / reply failed → show at the end. */
  afterIndex: number | null
}

/**
 * Where to attach the sign-up call-to-action in a conversation: under the answer to the MOST RECENT message that asked
 * for help creating an account. Later, unrelated questions don't make it disappear.
 */
export function findDonaSignupCtaPlacement(
  messages: readonly { role: string; text: string }[]
): DonaSignupCtaPlacement | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!
    if (m.role !== "user") continue
    const intent = detectDonaSignupIntent(m.text)
    if (!intent) continue
    const reply = messages.findIndex((x, j) => j > i && x.role === "assistant")
    return { intent, afterIndex: reply === -1 ? null : reply }
  }
  return null
}
