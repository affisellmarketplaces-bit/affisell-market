import type { AppLocale } from "@/lib/i18n-locale"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"

export type MerchantNewOrderAlertCopy = {
  preview: string
  heading: string
  intro: string
  productLabel: string
  qtyLabel: string
  buyerLabel: string
  partnerLabel: string
  payoutLabel: string
  orderLabel: string
  cta: string
  footer: string
  subject: (productName: string) => string
}

export type AffiliateNewSaleAlertCopy = {
  preview: string
  heading: string
  intro: string
  productLabel: string
  qtyLabel: string
  earningsLabel: string
  orderLabel: string
  cta: string
  footer: string
  subject: (productName: string) => string
}

const supplierFr: MerchantNewOrderAlertCopy = {
  preview: "Nouvelle commande à expédier",
  heading: "Commande payée",
  intro: "Un client vient de payer — préparez l'expédition depuis votre dashboard.",
  productLabel: "Produit",
  qtyLabel: "Quantité",
  buyerLabel: "Acheteur",
  partnerLabel: "Listing partenaire",
  payoutLabel: "Net wholesale",
  orderLabel: "Commande",
  cta: "Ouvrir les commandes à expédier",
  footer: "Alerte instantanée Affisell — expédiez avant la date limite SLA.",
  subject: (n) => `Commande à expédier · ${n}`,
}

const supplierEn: MerchantNewOrderAlertCopy = {
  preview: "New order to ship",
  heading: "Order paid",
  intro: "A buyer just paid — ship from your dashboard.",
  productLabel: "Product",
  qtyLabel: "Quantity",
  buyerLabel: "Buyer",
  partnerLabel: "Partner listing",
  payoutLabel: "Net wholesale",
  orderLabel: "Order",
  cta: "Open orders to ship",
  footer: "Instant Affisell alert — ship before your SLA deadline.",
  subject: (n) => `Order to ship · ${n}`,
}

const affiliateFr: AffiliateNewSaleAlertCopy = {
  preview: "Nouvelle vente sur votre boutique",
  heading: "Vente confirmée",
  intro: "Un client vient d'acheter sur votre vitrine — suivez vos gains en temps réel.",
  productLabel: "Produit",
  qtyLabel: "Quantité",
  earningsLabel: "Vos gains",
  orderLabel: "Commande",
  cta: "Voir mes gains",
  footer: "Alerte instantanée Affisell — le fournisseur prépare l'expédition.",
  subject: (n) => `Vente · ${n}`,
}

const affiliateEn: AffiliateNewSaleAlertCopy = {
  preview: "New sale on your store",
  heading: "Sale confirmed",
  intro: "A buyer just purchased from your storefront — track earnings in real time.",
  productLabel: "Product",
  qtyLabel: "Quantity",
  earningsLabel: "Your earnings",
  orderLabel: "Order",
  cta: "View earnings",
  footer: "Instant Affisell alert — your supplier is preparing shipment.",
  subject: (n) => `Sale · ${n}`,
}

export function copyForMerchantNewOrderAlert(locale: AppLocale): MerchantNewOrderAlertCopy {
  return locale === "fr" ? supplierFr : supplierEn
}

export function copyForAffiliateNewSaleAlert(locale: AppLocale): AffiliateNewSaleAlertCopy {
  return locale === "fr" ? affiliateFr : affiliateEn
}

export function formatMerchantAlertMoney(cents: number): string {
  return formatStoreCurrencyFromCents(Math.max(0, Math.round(cents)))
}

export function shortMerchantOrderRef(orderId: string): string {
  return orderId.slice(-8).toUpperCase()
}
