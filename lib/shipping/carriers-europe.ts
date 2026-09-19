/**
 * European carrier catalog — every European country has national operators, plus pan-European networks.
 * Client-safe (no Prisma). Data are REFERENCE facts (name, website, coverage, service type, typical delivery
 * window used only to PRE-FILL the supplier's form). Nothing here is ever shown to a buyer on its own:
 * a carrier appears on a product page only if the supplier defined it in their shop.
 *
 * Tracking: official deep links where the pattern is well known; otherwise the universal 17TRACK resolver.
 */
import type { Carrier, CarrierType } from "@/lib/shipping/carriers"

export const EU27_COUNTRY_CODES = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
  "PL", "PT", "RO", "SK", "SI", "ES", "SE",
] as const

/** Every European country/territory Affisell supports (RU/BY intentionally excluded — sanctions). */
export const EUROPE_COUNTRY_CODES = [
  ...EU27_COUNTRY_CODES,
  // EEA / EFTA / UK
  "GB", "NO", "IS", "LI", "CH",
  // Micro-states
  "AD", "MC", "SM", "VA",
  // Western Balkans, Eastern Europe, Türkiye
  "AL", "BA", "ME", "MK", "RS", "XK", "MD", "UA", "TR",
  // Territories
  "FO", "GI", "JE", "GG", "IM", "AX", "SJ",
] as const

export type EuropeCountryCode = (typeof EUROPE_COUNTRY_CODES)[number]

const EUROPE_SET: ReadonlySet<string> = new Set(EUROPE_COUNTRY_CODES)
const EU27_SET: ReadonlySet<string> = new Set(EU27_COUNTRY_CODES)

export const isEuropeanCountry = (cc: string): boolean => EUROPE_SET.has(cc.trim().toUpperCase())
export const isEuMemberCountry = (cc: string): boolean => EU27_SET.has(cc.trim().toUpperCase())

const TRACK_FALLBACK = "https://www.17track.net/en/track?nums={tracking}"

const PALETTE = ["#0F766E", "#1D4ED8", "#7C3AED", "#B45309", "#BE123C", "#0369A1", "#4D7C0F", "#9333EA", "#C2410C", "#0E7490"]
const colorFor = (id: string): string => {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]!
}

/** id, name, coverage, type, typical min/max days (pre-fill only), website, tracking url (null → 17TRACK). */
type Row = [string, string, string[], CarrierType, number, number, string, string | null]

const NAT = (cc: string) => [cc]
const EUROPE = ["EUROPE"]

const ROWS: Row[] = [
  // ── Pan-European networks ────────────────────────────────────────────────
  ["eu_dhl_parcel", "DHL Parcel Europe", EUROPE, "standard", 3, 6, "https://www.dhl.com/eu-en/home/express.html", null],
  ["eu_ups_standard", "UPS Standard (Europe)", EUROPE, "standard", 2, 5, "https://www.ups.com", "https://www.ups.com/track?tracknum={tracking}"],
  ["eu_ups_express", "UPS Express Saver (Europe)", EUROPE, "express", 1, 3, "https://www.ups.com", "https://www.ups.com/track?tracknum={tracking}"],
  ["eu_fedex_economy", "FedEx International Economy", EUROPE, "economy", 3, 6, "https://www.fedex.com", "https://www.fedex.com/fedextrack/?trknbr={tracking}"],
  ["eu_fedex_priority", "FedEx International Priority", EUROPE, "express", 1, 3, "https://www.fedex.com", "https://www.fedex.com/fedextrack/?trknbr={tracking}"],
  ["eu_tnt", "TNT Express (FedEx)", EUROPE, "express", 1, 3, "https://www.tnt.com", null],
  ["eu_gls", "GLS Europe", EUROPE, "standard", 2, 5, "https://gls-group.com", "https://gls-group.com/EU/en/parcel-tracking?match={tracking}"],
  ["eu_dpd", "DPD Group Europe", EUROPE, "standard", 2, 5, "https://www.dpdgroup.com", "https://tracking.dpd.de/parcelstatus?query={tracking}&locale=en_D2"],
  ["eu_geodis", "GEODIS", EUROPE, "standard", 2, 5, "https://geodis.com", null],
  ["eu_asendia", "Asendia", EUROPE, "economy", 4, 8, "https://www.asendia.com", null],
  ["eu_transoflex", "trans-o-flex", EUROPE, "standard", 2, 4, "https://www.trans-o-flex.com", null],
  ["eu_schenker", "DB Schenker", EUROPE, "standard", 2, 6, "https://www.dbschenker.com", null],
  ["eu_aramex", "Aramex Europe", EUROPE, "express", 2, 5, "https://www.aramex.com", null],
  ["eu_packeta", "Packeta (Zásilkovna) Europe", EUROPE, "pickup", 3, 6, "https://www.packeta.com", "https://tracking.packeta.com/en/?id={tracking}"],
  ["eu_mondial_relay", "Mondial Relay Europe", ["FR", "BE", "LU", "NL", "ES", "PT", "DE", "AT"], "pickup", 3, 6, "https://www.mondialrelay.com", null],

  // ── Western Europe ───────────────────────────────────────────────────────
  ["fr_relaiscolis", "Relais Colis", NAT("FR"), "pickup", 3, 5, "https://www.relaiscolis.com", null],
  ["fr_gls", "GLS France", NAT("FR"), "standard", 2, 4, "https://gls-group.com/FR", null],
  ["fr_ups", "UPS France", NAT("FR"), "express", 1, 2, "https://www.ups.com/fr", "https://www.ups.com/track?tracknum={tracking}"],
  ["be_dpd", "DPD Belgium", NAT("BE"), "standard", 1, 3, "https://www.dpdgroup.com/be", null],
  ["be_gls", "GLS Belgium", NAT("BE"), "standard", 1, 3, "https://gls-group.com/BE", null],
  ["be_dhl", "DHL Parcel Belgium", NAT("BE"), "standard", 1, 3, "https://www.dhlparcel.be", null],
  ["lu_dpd", "DPD Luxembourg", NAT("LU"), "standard", 1, 3, "https://www.dpd.com/lu", null],
  ["nl_dhl", "DHL Parcel Netherlands", NAT("NL"), "standard", 1, 2, "https://www.dhlparcel.nl", "https://www.dhlparcel.nl/en/consumer/track-and-trace?tt={tracking}"],
  ["nl_dpd", "DPD Netherlands", NAT("NL"), "standard", 1, 3, "https://www.dpdgroup.com/nl", null],
  ["nl_gls", "GLS Netherlands", NAT("NL"), "standard", 1, 3, "https://gls-group.com/NL", null],
  ["de_deutschepost", "Deutsche Post (Warenpost)", NAT("DE"), "economy", 2, 4, "https://www.deutschepost.de", null],
  ["de_gls", "GLS Germany", NAT("DE"), "standard", 1, 3, "https://gls-group.com/DE", null],
  ["de_ups", "UPS Germany", NAT("DE"), "express", 1, 2, "https://www.ups.com/de", "https://www.ups.com/track?tracknum={tracking}"],
  ["at_post", "Österreichische Post", NAT("AT"), "standard", 1, 3, "https://www.post.at", "https://www.post.at/en/track_trace.php?snr={tracking}"],
  ["at_dpd", "DPD Austria", NAT("AT"), "standard", 1, 3, "https://www.dpd.com/at", null],
  ["at_gls", "GLS Austria", NAT("AT"), "standard", 1, 3, "https://gls-group.com/AT", null],
  ["ch_post", "Swiss Post (Die Post)", NAT("CH"), "standard", 1, 2, "https://www.post.ch", null],
  ["ch_dpd", "DPD Switzerland", NAT("CH"), "standard", 1, 3, "https://www.dpd.com/ch", null],
  ["ch_planzer", "Planzer", NAT("CH"), "standard", 1, 3, "https://www.planzer.ch", null],
  ["li_post", "Liechtensteinische Post", NAT("LI"), "standard", 1, 3, "https://www.post.li", null],
  ["ie_anpost", "An Post", NAT("IE"), "standard", 1, 3, "https://www.anpost.com", "https://track.anpost.com/TrackingResults.aspx?rtt=1&items={tracking}"],
  ["ie_dpd", "DPD Ireland", NAT("IE"), "standard", 1, 3, "https://www.dpd.ie", null],
  ["ie_aramex", "Aramex Ireland (Fastway)", NAT("IE"), "economy", 2, 4, "https://www.aramex.ie", null],
  ["gb_dpd", "DPD UK", NAT("GB"), "standard", 1, 3, "https://www.dpd.co.uk", null],
  ["gb_yodel", "Yodel", NAT("GB"), "economy", 2, 4, "https://www.yodel.co.uk", null],
  ["gb_dhl", "DHL Parcel UK", NAT("GB"), "standard", 1, 3, "https://www.dhlparcel.co.uk", null],
  ["je_post", "Jersey Post", NAT("JE"), "standard", 2, 5, "https://www.jerseypost.com", null],
  ["gg_post", "Guernsey Post", NAT("GG"), "standard", 2, 5, "https://www.guernseypost.com", null],
  ["im_post", "Isle of Man Post Office", NAT("IM"), "standard", 2, 5, "https://www.iompost.com", null],
  ["gi_post", "Royal Gibraltar Post Office", NAT("GI"), "standard", 3, 7, "https://www.post.gi", null],
  ["mc_post", "La Poste Monaco", NAT("MC"), "standard", 2, 4, "https://www.lapostemonaco.mc", null],
  ["ad_post", "La Poste Andorra", NAT("AD"), "standard", 3, 6, "https://www.laposte.ad", null],

  // ── Southern Europe ──────────────────────────────────────────────────────
  ["es_correos_express", "Correos Express", NAT("ES"), "express", 1, 2, "https://www.correosexpress.com", null],
  ["es_mrw", "MRW", NAT("ES"), "express", 1, 2, "https://www.mrw.es", null],
  ["es_nacex", "Nacex", NAT("ES"), "express", 1, 2, "https://www.nacex.es", null],
  ["es_gls", "GLS Spain", NAT("ES"), "standard", 1, 3, "https://gls-group.com/ES", null],
  ["pt_ctt_expresso", "CTT Expresso", NAT("PT"), "express", 1, 2, "https://www.ctt.pt", null],
  ["pt_dpd", "DPD Portugal", NAT("PT"), "standard", 1, 3, "https://www.dpd.pt", null],
  ["it_sda", "SDA Express Courier", NAT("IT"), "standard", 1, 3, "https://www.sda.it", null],
  ["it_dhl", "DHL Express Italy", NAT("IT"), "express", 1, 2, "https://www.dhl.com/it", null],
  ["mt_post", "MaltaPost", NAT("MT"), "standard", 2, 5, "https://www.maltapost.com", null],
  ["cy_post", "Cyprus Post", NAT("CY"), "standard", 3, 6, "https://www.cypruspost.post", null],
  ["gr_elta", "ELTA Hellenic Post", NAT("GR"), "standard", 2, 5, "https://www.elta.gr", null],
  ["gr_acs", "ACS Courier", NAT("GR"), "express", 1, 2, "https://www.acscourier.net", null],
  ["gr_speedex", "Speedex", NAT("GR"), "express", 1, 3, "https://www.speedex.gr", null],
  ["gr_geniki", "Geniki Taxydromiki", NAT("GR"), "standard", 1, 3, "https://www.taxydromiki.com", null],
  ["sm_post", "Poste San Marino", NAT("SM"), "standard", 3, 6, "https://www.poste.sm", null],
  ["va_post", "Poste Vaticane", NAT("VA"), "standard", 3, 6, "https://www.vaticanstate.va", null],

  // ── Northern Europe ──────────────────────────────────────────────────────
  ["se_postnord", "PostNord Sweden", NAT("SE"), "standard", 1, 3, "https://www.postnord.se", null],
  ["se_budbee", "Budbee", NAT("SE"), "express", 1, 2, "https://www.budbee.com", null],
  ["se_schenker", "DB Schenker Sweden", NAT("SE"), "standard", 1, 3, "https://www.dbschenker.com/se", null],
  ["dk_postnord", "PostNord Denmark", NAT("DK"), "standard", 1, 3, "https://www.postnord.dk", null],
  ["dk_gls", "GLS Denmark", NAT("DK"), "standard", 1, 3, "https://gls-group.com/DK", null],
  ["dk_dao", "DAO", NAT("DK"), "economy", 1, 3, "https://www.dao.as", null],
  ["no_posten", "Posten Norge", NAT("NO"), "standard", 1, 4, "https://www.posten.no", "https://sporing.posten.no/sporing/{tracking}"],
  ["no_bring", "Bring", NAT("NO"), "standard", 1, 3, "https://www.bring.no", null],
  ["sj_posten", "Posten Norge (Svalbard)", NAT("SJ"), "standard", 5, 12, "https://www.posten.no", null],
  ["fi_posti", "Posti", NAT("FI"), "standard", 1, 3, "https://www.posti.fi", "https://www.posti.fi/en/tracking#/lahetys/{tracking}"],
  ["fi_matkahuolto", "Matkahuolto", NAT("FI"), "pickup", 1, 3, "https://www.matkahuolto.fi", null],
  ["ax_posten", "Posten Åland", NAT("AX"), "standard", 2, 5, "https://www.posten.ax", null],
  ["is_postur", "Pósturinn (Iceland Post)", NAT("IS"), "standard", 3, 7, "https://www.postur.is", null],
  ["fo_post", "Postverk Føroya", NAT("FO"), "standard", 4, 9, "https://www.post.fo", null],
  ["ee_omniva", "Omniva Estonia", NAT("EE"), "pickup", 1, 3, "https://www.omniva.ee", null],
  ["ee_dpd", "DPD Estonia", NAT("EE"), "standard", 1, 3, "https://www.dpd.com/ee", null],
  ["lv_pasts", "Latvijas Pasts", NAT("LV"), "standard", 2, 4, "https://www.pasts.lv", null],
  ["lv_omniva", "Omniva Latvia", NAT("LV"), "pickup", 1, 3, "https://www.omniva.lv", null],
  ["lv_dpd", "DPD Latvija", NAT("LV"), "standard", 1, 3, "https://www.dpd.com/lv", null],
  ["lt_post", "Lietuvos paštas", NAT("LT"), "standard", 2, 4, "https://www.post.lt", null],
  ["lt_lpexpress", "LP Express", NAT("LT"), "pickup", 1, 3, "https://www.lpexpress.lt", null],
  ["lt_dpd", "DPD Lietuva", NAT("LT"), "standard", 1, 3, "https://www.dpd.com/lt", null],

  // ── Central & Eastern Europe ─────────────────────────────────────────────
  ["pl_poczta", "Poczta Polska", NAT("PL"), "standard", 2, 4, "https://www.poczta-polska.pl", "https://emonitoring.poczta-polska.pl/?numer={tracking}"],
  ["pl_dpd", "DPD Polska", NAT("PL"), "standard", 1, 2, "https://www.dpd.com.pl", null],
  ["pl_dhl", "DHL Parcel Poland", NAT("PL"), "standard", 1, 3, "https://www.dhl.com/pl", null],
  ["pl_orlen", "Orlen Paczka", NAT("PL"), "pickup", 1, 3, "https://www.orlenpaczka.pl", null],
  ["pl_gls", "GLS Poland", NAT("PL"), "standard", 1, 3, "https://gls-group.com/PL", null],
  ["cz_post", "Česká pošta", NAT("CZ"), "standard", 2, 4, "https://www.ceskaposta.cz", null],
  ["cz_packeta", "Zásilkovna (Packeta)", NAT("CZ"), "pickup", 1, 3, "https://www.zasilkovna.cz", "https://tracking.packeta.com/en/?id={tracking}"],
  ["cz_ppl", "PPL", NAT("CZ"), "standard", 1, 3, "https://www.ppl.cz", null],
  ["sk_post", "Slovenská pošta", NAT("SK"), "standard", 2, 4, "https://www.posta.sk", null],
  ["sk_dpd", "DPD Slovakia", NAT("SK"), "standard", 1, 3, "https://www.dpd.com/sk", null],
  ["sk_gls", "GLS Slovakia", NAT("SK"), "standard", 1, 3, "https://gls-group.com/SK", null],
  ["hu_post", "Magyar Posta", NAT("HU"), "standard", 2, 4, "https://www.posta.hu", null],
  ["hu_gls", "GLS Hungary", NAT("HU"), "standard", 1, 3, "https://gls-group.com/HU", null],
  ["hu_foxpost", "Foxpost", NAT("HU"), "pickup", 1, 3, "https://www.foxpost.hu", null],
  ["hu_dpd", "DPD Hungary", NAT("HU"), "standard", 1, 3, "https://www.dpd.com/hu", null],
  ["ro_posta", "Poșta Română", NAT("RO"), "standard", 2, 5, "https://www.posta-romana.ro", null],
  ["ro_fan", "Fan Courier", NAT("RO"), "express", 1, 2, "https://www.fancourier.ro", null],
  ["ro_sameday", "Sameday", NAT("RO"), "express", 1, 2, "https://sameday.ro", null],
  ["ro_cargus", "Cargus", NAT("RO"), "standard", 1, 3, "https://www.cargus.ro", null],
  ["bg_posts", "Bulgarian Posts", NAT("BG"), "standard", 2, 5, "https://www.bgpost.bg", null],
  ["bg_speedy", "Speedy", NAT("BG"), "express", 1, 2, "https://www.speedy.bg", null],
  ["bg_econt", "Econt Express", NAT("BG"), "express", 1, 2, "https://www.econt.com", null],
  ["si_posta", "Pošta Slovenije", NAT("SI"), "standard", 1, 3, "https://www.posta.si", null],
  ["si_gls", "GLS Slovenia", NAT("SI"), "standard", 1, 3, "https://gls-group.com/SI", null],
  ["hr_posta", "Hrvatska pošta", NAT("HR"), "standard", 2, 4, "https://www.posta.hr", null],
  ["hr_gls", "GLS Croatia", NAT("HR"), "standard", 1, 3, "https://gls-group.com/HR", null],
  ["hr_dpd", "DPD Croatia", NAT("HR"), "standard", 1, 3, "https://www.dpd.com/hr", null],

  // ── Western Balkans, Eastern neighbours, Türkiye ─────────────────────────
  ["rs_posta", "Pošta Srbije", NAT("RS"), "standard", 2, 5, "https://www.posta.rs", null],
  ["rs_dexpress", "D Express", NAT("RS"), "express", 1, 2, "https://www.dexpress.rs", null],
  ["rs_cityexpress", "City Express", NAT("RS"), "express", 1, 2, "https://cityexpress.rs", null],
  ["ba_bhposta", "BH Pošta", NAT("BA"), "standard", 3, 6, "https://www.posta.ba", null],
  ["ba_postesrpske", "Pošte Srpske", NAT("BA"), "standard", 3, 6, "https://www.postesrpske.com", null],
  ["ba_hpmostar", "HP Mostar", NAT("BA"), "standard", 3, 6, "https://www.hpm.ba", null],
  ["me_posta", "Pošta Crne Gore", NAT("ME"), "standard", 3, 6, "https://www.posta.co.me", null],
  ["mk_posta", "Macedonian Post", NAT("MK"), "standard", 3, 6, "https://www.posta.com.mk", null],
  ["al_posta", "Posta Shqiptare", NAT("AL"), "standard", 3, 7, "https://www.postashqiptare.al", null],
  ["xk_posta", "Posta e Kosovës", NAT("XK"), "standard", 3, 7, "https://www.postakosoves.com", null],
  ["md_posta", "Poșta Moldovei", NAT("MD"), "standard", 3, 7, "https://www.posta.md", null],
  ["ua_novaposhta", "Nova Poshta", NAT("UA"), "express", 1, 3, "https://novaposhta.ua", "https://novaposhta.ua/tracking/?cargo_number={tracking}"],
  ["ua_ukrposhta", "Ukrposhta", NAT("UA"), "standard", 2, 6, "https://ukrposhta.ua", "https://track.ukrposhta.ua/tracking_UA.html?barcode={tracking}"],
  ["ua_meest", "Meest", NAT("UA"), "standard", 2, 6, "https://meest.com", null],
  ["tr_ptt", "PTT Kargo (Türkiye)", NAT("TR"), "standard", 2, 5, "https://www.ptt.gov.tr", null],
  ["tr_yurtici", "Yurtiçi Kargo", NAT("TR"), "express", 1, 3, "https://www.yurticikargo.com", null],
  ["tr_aras", "Aras Kargo", NAT("TR"), "express", 1, 3, "https://www.araskargo.com.tr", null],
  ["tr_mng", "MNG Kargo", NAT("TR"), "standard", 1, 3, "https://www.mngkargo.com.tr", null],
]

export const EUROPE_CARRIERS: Carrier[] = ROWS.map(([id, name, country, type, delivery_min, delivery_max, website, tracking]) => ({
  id,
  name,
  country,
  type,
  delivery_min,
  delivery_max,
  tracking_url: tracking ?? TRACK_FALLBACK,
  logo: "", // no hotlinked logos: the UI draws a monogram (privacy + no broken images)
  website,
  color: colorFor(id),
}))
