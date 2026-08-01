/**
 * Affisell shipping — pro carriers by country (logos + tracking templates).
 * Client-safe (no Prisma). Distinct from `carrier-directory.ts` (legal/checkout taxonomy).
 */

export type CarrierType = "express" | "standard" | "economy" | "pickup"

export type Carrier = {
  id: string
  name: string
  /** ISO2 codes plus regional tags EU / WORLD */
  country: string[]
  type: CarrierType
  delivery_min: number
  delivery_max: number
  /** 0–100 */
  reliability: number
  /** Official tracking URL with `{tracking}` placeholder */
  tracking_url: string
  logo: string
  website: string
  color: string
}

export const CARRIERS: Carrier[] = [
  // FRANCE 5
  {
    id: "fr_colissimo",
    name: "Colissimo",
    country: ["FR"],
    type: "standard",
    delivery_min: 2,
    delivery_max: 3,
    reliability: 92,
    tracking_url: "https://www.laposte.fr/outils/suivre-vos-envois?code={tracking}",
    logo: "https://upload.wikimedia.org/wikipedia/commons/8/8a/Logo_Colissimo.svg",
    website: "https://www.laposte.fr",
    color: "#FFCC00",
  },
  {
    id: "fr_chronopost",
    name: "Chronopost",
    country: ["FR", "EU"],
    type: "express",
    delivery_min: 1,
    delivery_max: 1,
    reliability: 95,
    tracking_url: "https://www.chronopost.fr/tracking?code={tracking}",
    logo: "https://upload.wikimedia.org/wikipedia/commons/5/5a/Chronopost_logo.svg",
    website: "https://www.chronopost.fr",
    color: "#003DA5",
  },
  {
    id: "fr_mondial",
    name: "Mondial Relay",
    country: ["FR", "BE", "NL", "ES", "DE"],
    type: "pickup",
    delivery_min: 3,
    delivery_max: 5,
    reliability: 88,
    tracking_url: "https://www.mondialrelay.fr/suivi-de-colis?code={tracking}",
    logo: "https://upload.wikimedia.org/wikipedia/commons/3/3d/Mondial_Relay_logo.svg",
    website: "https://www.mondialrelay.fr",
    color: "#E30613",
  },
  {
    id: "fr_dpd",
    name: "DPD France",
    country: ["FR", "EU"],
    type: "standard",
    delivery_min: 2,
    delivery_max: 4,
    reliability: 90,
    tracking_url: "https://trace.dpd.fr/{tracking}",
    logo: "https://upload.wikimedia.org/wikipedia/commons/0/0b/DPD_logo.svg",
    website: "https://www.dpd.fr",
    color: "#DC0032",
  },
  {
    id: "fr_colisprive",
    name: "Colis Privé",
    country: ["FR"],
    type: "economy",
    delivery_min: 3,
    delivery_max: 5,
    reliability: 82,
    tracking_url: "https://www.colisprive.com/mon-colis?code={tracking}",
    logo: "https://www.colisprive.com/wp-content/uploads/2020/04/logo-colis-prive.svg",
    website: "https://www.colisprive.com",
    color: "#000000",
  },

  // ALLEMAGNE 4
  {
    id: "de_dhl",
    name: "DHL Paket",
    country: ["DE", "EU"],
    type: "standard",
    delivery_min: 2,
    delivery_max: 3,
    reliability: 94,
    tracking_url:
      "https://www.dhl.de/de/privatkunden/dhl-sendungsverfolgung.html?piececode={tracking}",
    logo: "https://upload.wikimedia.org/wikipedia/commons/a/ac/DHL_Express_logo.svg",
    website: "https://www.dhl.de",
    color: "#FFCC00",
  },
  {
    id: "de_dhl_express",
    name: "DHL Express",
    country: ["DE", "EU", "WORLD"],
    type: "express",
    delivery_min: 1,
    delivery_max: 2,
    reliability: 96,
    tracking_url: "https://www.dhl.com/global-en/mydhl/tracking.html?AWB={tracking}",
    logo: "https://upload.wikimedia.org/wikipedia/commons/a/ac/DHL_Express_logo.svg",
    website: "https://www.dhl.com",
    color: "#FFCC00",
  },
  {
    id: "de_hermes",
    name: "Hermes",
    country: ["DE"],
    type: "economy",
    delivery_min: 3,
    delivery_max: 5,
    reliability: 84,
    tracking_url: "https://www.myhermes.de/empfangen/sendungsverfolgung/{tracking}",
    logo: "https://upload.wikimedia.org/wikipedia/commons/8/8c/Hermes_Logistik_Logo.svg",
    website: "https://www.myhermes.de",
    color: "#0091CD",
  },
  {
    id: "de_dpduk",
    name: "DPD Germany",
    country: ["DE", "EU"],
    type: "standard",
    delivery_min: 2,
    delivery_max: 4,
    reliability: 89,
    tracking_url: "https://tracking.dpd.de/status/{tracking}",
    logo: "https://upload.wikimedia.org/wikipedia/commons/0/0b/DPD_logo.svg",
    website: "https://www.dpd.com/de",
    color: "#DC0032",
  },

  // UK 3
  {
    id: "uk_royal",
    name: "Royal Mail",
    country: ["GB"],
    type: "standard",
    delivery_min: 1,
    delivery_max: 2,
    reliability: 90,
    tracking_url: "https://www.royalmail.com/track-your-item?code={tracking}",
    logo: "https://upload.wikimedia.org/wikipedia/commons/3/3a/Royal_Mail_logo.svg",
    website: "https://www.royalmail.com",
    color: "#CE0E2D",
  },
  {
    id: "uk_parcelforce",
    name: "Parcelforce",
    country: ["GB", "EU"],
    type: "express",
    delivery_min: 1,
    delivery_max: 2,
    reliability: 93,
    tracking_url: "https://www.parcelforce.com/track-trace?code={tracking}",
    logo: "https://upload.wikimedia.org/wikipedia/commons/6/6a/Parcelforce_Worldwide_logo.svg",
    website: "https://www.parcelforce.com",
    color: "#CE0E2D",
  },
  {
    id: "uk_evri",
    name: "Evri",
    country: ["GB"],
    type: "economy",
    delivery_min: 2,
    delivery_max: 4,
    reliability: 80,
    tracking_url: "https://www.evri.com/track-a-parcel?code={tracking}",
    logo: "https://upload.wikimedia.org/wikipedia/commons/5/5d/Evri_logo.svg",
    website: "https://www.evri.com",
    color: "#00A650",
  },

  // ESPAGNE 2
  {
    id: "es_correos",
    name: "Correos",
    country: ["ES"],
    type: "standard",
    delivery_min: 2,
    delivery_max: 4,
    reliability: 87,
    tracking_url:
      "https://www.correos.es/es/herramientas/localizador/envios/detalle?code={tracking}",
    logo: "https://upload.wikimedia.org/wikipedia/commons/6/6e/Correos_logo.svg",
    website: "https://www.correos.es",
    color: "#FFCC00",
  },
  {
    id: "es_seur",
    name: "SEUR / DPD",
    country: ["ES", "EU"],
    type: "standard",
    delivery_min: 1,
    delivery_max: 3,
    reliability: 90,
    tracking_url: "https://www.seur.com/livetracking?code={tracking}",
    logo: "https://upload.wikimedia.org/wikipedia/commons/7/7d/SEUR_logo.svg",
    website: "https://www.seur.com",
    color: "#FF6600",
  },

  // ITALIE 3
  {
    id: "it_poste",
    name: "Poste Italiane",
    country: ["IT"],
    type: "standard",
    delivery_min: 2,
    delivery_max: 4,
    reliability: 85,
    tracking_url: "https://www.poste.it/cerca/index.html#/risultati-spedizioni/{tracking}",
    logo: "https://upload.wikimedia.org/wikipedia/commons/0/0b/Poste_Italiane_logo.svg",
    website: "https://www.poste.it",
    color: "#FFCC00",
  },
  {
    id: "it_bartolini",
    name: "BRT Bartolini",
    country: ["IT", "EU"],
    type: "express",
    delivery_min: 1,
    delivery_max: 2,
    reliability: 92,
    tracking_url: "https://www.brt.it/tracking?code={tracking}",
    logo: "https://www.brt.it/static/img/logo.svg",
    website: "https://www.brt.it",
    color: "#E30613",
  },
  {
    id: "it_gls",
    name: "GLS Italy",
    country: ["IT", "EU"],
    type: "standard",
    delivery_min: 2,
    delivery_max: 3,
    reliability: 89,
    tracking_url: "https://www.gls-italy.com/?code={tracking}",
    logo: "https://upload.wikimedia.org/wikipedia/commons/8/8a/GLS_Logo.svg",
    website: "https://www.gls-italy.com",
    color: "#003366",
  },

  // BENELUX 2
  {
    id: "be_bpost",
    name: "bpost",
    country: ["BE"],
    type: "standard",
    delivery_min: 1,
    delivery_max: 2,
    reliability: 91,
    tracking_url: "https://track.bpost.be/{tracking}",
    logo: "https://upload.wikimedia.org/wikipedia/commons/6/6b/Bpost_logo.svg",
    website: "https://www.bpost.be",
    color: "#E30613",
  },
  {
    id: "nl_postnl",
    name: "PostNL",
    country: ["NL"],
    type: "standard",
    delivery_min: 1,
    delivery_max: 2,
    reliability: 93,
    tracking_url: "https://www.postnl.nl/en/track-and-trace/{tracking}",
    logo: "https://upload.wikimedia.org/wikipedia/commons/9/9e/PostNL_logo.svg",
    website: "https://www.postnl.nl",
    color: "#FF6600",
  },

  // PL / PT / LU
  {
    id: "pl_inpost",
    name: "InPost",
    country: ["PL", "EU"],
    type: "pickup",
    delivery_min: 2,
    delivery_max: 3,
    reliability: 91,
    tracking_url: "https://inpost.pl/szybkie-nadania?code={tracking}",
    logo: "https://upload.wikimedia.org/wikipedia/commons/2/2d/InPost_logo.svg",
    website: "https://inpost.pl",
    color: "#FFCC00",
  },
  {
    id: "pt_ctt",
    name: "CTT Portugal",
    country: ["PT"],
    type: "standard",
    delivery_min: 2,
    delivery_max: 3,
    reliability: 86,
    tracking_url:
      "https://www.ctt.pt/feapl_2/app/open/objectSearch/objectSearch.jspx?code={tracking}",
    logo: "https://upload.wikimedia.org/wikipedia/commons/5/5f/CTT_logo.svg",
    website: "https://www.ctt.pt",
    color: "#E30613",
  },
  {
    id: "lu_post",
    name: "POST Luxembourg",
    country: ["LU", "EU"],
    type: "standard",
    delivery_min: 1,
    delivery_max: 3,
    reliability: 90,
    tracking_url: "https://www.post.lu/particuliers/colis/suivi?code={tracking}",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/POST_Luxembourg_logo.svg/320px-POST_Luxembourg_logo.svg.png",
    website: "https://www.post.lu",
    color: "#E30613",
  },

  // US / WORLD 3
  {
    id: "us_usps",
    name: "USPS",
    country: ["US"],
    type: "standard",
    delivery_min: 2,
    delivery_max: 5,
    reliability: 86,
    tracking_url: "https://tools.usps.com/go/TrackConfirmAction_input?qtc_tLabels1={tracking}",
    logo: "https://upload.wikimedia.org/wikipedia/commons/1/1a/USPS_logo.svg",
    website: "https://www.usps.com",
    color: "#004B8D",
  },
  {
    id: "us_ups",
    name: "UPS",
    country: ["US", "EU", "WORLD"],
    type: "express",
    delivery_min: 1,
    delivery_max: 3,
    reliability: 95,
    tracking_url: "https://www.ups.com/track?tracknum={tracking}",
    logo: "https://upload.wikimedia.org/wikipedia/commons/6/6b/United_Parcel_Service_logo_2014.svg",
    website: "https://www.ups.com",
    color: "#FFB500",
  },
  {
    id: "us_fedex",
    name: "FedEx",
    country: ["US", "EU", "WORLD"],
    type: "express",
    delivery_min: 1,
    delivery_max: 3,
    reliability: 94,
    tracking_url: "https://www.fedex.com/fedextrack/?trknbr={tracking}",
    logo: "https://upload.wikimedia.org/wikipedia/commons/7/7b/FedEx_Express.svg",
    website: "https://www.fedex.com",
    color: "#4D148C",
  },

  // CHINE DROPSHIPPING 3
  {
    id: "cn_yun",
    name: "YunExpress",
    country: ["CN", "EU", "WORLD"],
    type: "economy",
    delivery_min: 8,
    delivery_max: 14,
    reliability: 80,
    tracking_url: "https://www.yunexpress.com/track?code={tracking}",
    logo: "https://www.yunexpress.com/images/logo.png",
    website: "https://www.yunexpress.com",
    color: "#FF6600",
  },
  {
    id: "cn_4px",
    name: "4PX",
    country: ["CN", "EU"],
    type: "economy",
    delivery_min: 7,
    delivery_max: 12,
    reliability: 82,
    tracking_url: "https://www.4px.com/tracking?code={tracking}",
    logo: "https://www.4px.com/images/logo.png",
    website: "https://www.4px.com",
    color: "#003366",
  },
  {
    id: "cn_cainiao",
    name: "Cainiao",
    country: ["CN", "EU", "WORLD"],
    type: "economy",
    delivery_min: 8,
    delivery_max: 16,
    reliability: 78,
    tracking_url: "https://global.cainiao.com/detail?code={tracking}",
    logo: "https://upload.wikimedia.org/wikipedia/commons/0/0e/Cainiao_logo.svg",
    website: "https://global.cainiao.com",
    color: "#FF6A00",
  },
]

export function getCarriersByCountry(cc: string): Carrier[] {
  const code = cc.trim().toUpperCase()
  if (!code) return []
  return CARRIERS.filter(
    (c) => c.country.includes(code) || c.country.includes("EU") || c.country.includes("WORLD")
  ).sort((a, b) => b.reliability - a.reliability)
}

export type RecommendedCarriers = {
  fastest: Carrier | null
  cheapest: Carrier | null
  balanced: Carrier | null
  all: Carrier[]
}

function balancedScore(c: Carrier): number {
  return c.reliability * 2 - c.delivery_max
}

/**
 * Country recommendations: fastest express, cheapest reliable economy/pickup, best balanced ratio.
 */
export function getRecommended(country: string): RecommendedCarriers {
  const all = getCarriersByCountry(country)

  const express = all.filter((c) => c.type === "express")
  const fastest =
    [...express].sort(
      (a, b) =>
        a.delivery_max - b.delivery_max ||
        a.delivery_min - b.delivery_min ||
        b.reliability - a.reliability
    )[0] ?? null

  const cheapPool = all.filter(
    (c) => (c.type === "economy" || c.type === "pickup") && c.reliability >= 80
  )
  const cheapest =
    [...cheapPool].sort(
      (a, b) =>
        b.delivery_max - a.delivery_max ||
        a.reliability - b.reliability ||
        (a.type === "economy" ? -1 : 1) - (b.type === "economy" ? -1 : 1)
    )[0] ?? null

  const balanced =
    [...all].sort((a, b) => balancedScore(b) - balancedScore(a) || b.reliability - a.reliability)[0] ??
    null

  return { fastest, cheapest, balanced, all }
}

export function carrierOfficialTrackingUrl(carrier: Carrier, tracking: string): string {
  return carrier.tracking_url.replaceAll("{tracking}", encodeURIComponent(tracking.trim()))
}

export function findCarrierById(id: string): Carrier | null {
  return CARRIERS.find((c) => c.id === id) ?? null
}
