/**
 * Canonical URLs for buyer-facing legal citations.
 * FR national → Légifrance · EU → EUR-Lex / Commission · extracommunitaire → official EN portals.
 */

export type NormativeScope = "fr" | "eu" | "international"

export type NormativeSource = {
  scope: NormativeScope
  labelFr: string
  labelEn: string
  /** Légifrance or French official text */
  urlFr?: string
  /** EUR-Lex CELEX / EU portal */
  urlEu?: string
  /** International fallback (EN) */
  urlEn?: string
}

export const NORMATIVE_SOURCES = {
  /** Code de la consommation — droit de rétractation (14 j). */
  L221_18: {
    scope: "fr",
    labelFr: "art. L221-18 du Code de la consommation",
    labelEn: "French Consumer Code art. L221-18",
    urlFr: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006296027/",
    urlEu: "https://eur-lex.europa.eu/eli/dir/2011/83/oj",
  },
  /** Délai maximal de remboursement après rétractation. */
  L221_24: {
    scope: "fr",
    labelFr: "art. L221-24 du Code de la consommation",
    labelEn: "French Consumer Code art. L221-24",
    urlFr: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006296029/",
    urlEu: "https://eur-lex.europa.eu/eli/dir/2011/83/oj",
  },
  /** Exceptions au droit de rétractation. */
  L221_28: {
    scope: "fr",
    labelFr: "art. L221-28 du Code de la consommation",
    labelEn: "French Consumer Code art. L221-28",
    urlFr: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006296033/",
    urlEu: "https://eur-lex.europa.eu/eli/dir/2011/83/oj",
  },
  /** Garantie légale de conformité (2 ans). */
  L217_4: {
    scope: "fr",
    labelFr: "art. L217-4 du Code de la consommation",
    labelEn: "French Consumer Code art. L217-4",
    urlFr: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006296007/",
    urlEu: "https://eur-lex.europa.eu/eli/dir/2011/83/oj",
  },
  /** Médiation de la consommation. */
  L612_1: {
    scope: "fr",
    labelFr: "art. L612-1 du Code de la consommation",
    labelEn: "French Consumer Code art. L612-1",
    urlFr: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006296291/",
    urlEu: "https://eur-lex.europa.eu/eli/dir/2013/11/oj",
  },
  /** LCEN — mentions légales (éditeur, hébergeur). */
  LCEN_2004_575: {
    scope: "fr",
    labelFr: "loi n° 2004-575 (LCEN), art. 6 III",
    labelEn: "French LCEN Act 2004-575, art. 6 III",
    urlFr: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006070721/",
  },
  /** Code de la propriété intellectuelle — contrefaçon. */
  CPI_L122_4: {
    scope: "fr",
    labelFr: "Code de la propriété intellectuelle",
    labelEn: "French Intellectual Property Code",
    urlFr: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006278910/",
  },
  /** Directive droits des consommateurs (information précontractuelle, rétractation). */
  DIRECTIVE_2011_83: {
    scope: "eu",
    labelFr: "directive 2011/83/UE",
    labelEn: "EU Directive 2011/83/EU",
    urlEu: "https://eur-lex.europa.eu/eli/dir/2011/83/oj",
    urlEn: "https://eur-lex.europa.eu/eli/dir/2011/83/oj",
  },
  /** Règlement ODR — plateforme européenne de règlement des litiges. */
  EU_ODR_524_2013: {
    scope: "eu",
    labelFr: "règlement UE n° 524/2013 (ODR)",
    labelEn: "EU Regulation 524/2013 (ODR)",
    urlFr: "https://ec.europa.eu/consumers/odr",
    urlEu: "https://ec.europa.eu/consumers/odr",
    urlEn: "https://ec.europa.eu/consumers/odr",
  },
  /** RGPD / GDPR. */
  GDPR: {
    scope: "eu",
    labelFr: "règlement UE 2016/679 (RGPD)",
    labelEn: "EU Regulation 2016/679 (GDPR)",
    urlEu: "https://eur-lex.europa.eu/eli/reg/2016/679/oj",
    urlEn: "https://eur-lex.europa.eu/eli/reg/2016/679/oj",
  },
  /** PSD2 — authentification forte (3D Secure). */
  PSD2_2015_2366: {
    scope: "eu",
    labelFr: "directive UE 2015/2366 (PSD2)",
    labelEn: "EU Directive 2015/2366 (PSD2)",
    urlEu: "https://eur-lex.europa.eu/eli/dir/2015/2366/oj",
    urlEn: "https://eur-lex.europa.eu/eli/dir/2015/2366/oj",
  },
  /** ePrivacy — cookies et communications électroniques. */
  EPRIVACY_2002_58: {
    scope: "eu",
    labelFr: "directive 2002/58/CE (ePrivacy)",
    labelEn: "EU Directive 2002/58/EC (ePrivacy)",
    urlEu: "https://eur-lex.europa.eu/eli/dir/2002/58/oj",
    urlEn: "https://eur-lex.europa.eu/eli/dir/2002/58/oj",
  },
  /** Autorité française de protection des données. */
  CNIL: {
    scope: "international",
    labelFr: "CNIL",
    labelEn: "CNIL (French DPA)",
    urlFr: "https://www.cnil.fr/",
    urlEn: "https://www.cnil.fr/en",
  },
} as const satisfies Record<string, NormativeSource>

export type NormativeId = keyof typeof NORMATIVE_SOURCES

export const L221_28_LEGIFRANCE_URL = NORMATIVE_SOURCES.L221_28.urlFr!

export function normativeUrl(id: NormativeId, locale: string): string {
  const src = NORMATIVE_SOURCES[id]
  const fr = locale.startsWith("fr")
  if (fr) return src.urlFr ?? src.urlEu ?? src.urlEn ?? "#"
  return src.urlEu ?? src.urlEn ?? src.urlFr ?? "#"
}
