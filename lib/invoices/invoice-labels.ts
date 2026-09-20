/** Customer-invoice wording. `zh` falls back to English: the built-in PDF font has no CJK glyphs. */
export type InvoiceLocale = "en" | "fr" | "de" | "es" | "it" | "nl" | "pl"

export type InvoiceLabels = {
  title: string
  orderRef: string
  issuedOn: string
  paidOn: string
  billedTo: string
  item: string
  quantity: string
  unitPrice: string
  amount: string
  exclVat: string
  vat: string
  inclVat: string
  total: string
  amountPaid: string
  paymentCard: string
  deliveredBy: string
}

const LABELS: Record<InvoiceLocale, InvoiceLabels> = {
  en: { title: "Customer invoice", orderRef: "Order", issuedOn: "Date", paidOn: "Paid on", billedTo: "Customer", item: "Item", quantity: "Qty", unitPrice: "Unit price", amount: "Amount", exclVat: "Amount excl. VAT", vat: "VAT", inclVat: "Total incl. VAT", total: "Total", amountPaid: "Amount paid", paymentCard: "Paid by card", deliveredBy: "Delivered by" },
  fr: { title: "Facture client", orderRef: "Commande", issuedOn: "Date", paidOn: "Payée le", billedTo: "Client", item: "Article", quantity: "Qté", unitPrice: "Prix unitaire", amount: "Montant", exclVat: "Montant HT", vat: "TVA", inclVat: "Total TTC", total: "Total", amountPaid: "Montant payé", paymentCard: "Payée par carte", deliveredBy: "Livré par" },
  de: { title: "Kundenrechnung", orderRef: "Bestellung", issuedOn: "Datum", paidOn: "Bezahlt am", billedTo: "Kunde", item: "Artikel", quantity: "Menge", unitPrice: "Einzelpreis", amount: "Betrag", exclVat: "Betrag netto", vat: "MwSt.", inclVat: "Gesamt brutto", total: "Gesamt", amountPaid: "Bezahlter Betrag", paymentCard: "Bezahlt per Karte", deliveredBy: "Geliefert von" },
  es: { title: "Factura de cliente", orderRef: "Pedido", issuedOn: "Fecha", paidOn: "Pagado el", billedTo: "Cliente", item: "Artículo", quantity: "Cant.", unitPrice: "Precio unitario", amount: "Importe", exclVat: "Importe sin IVA", vat: "IVA", inclVat: "Total con IVA", total: "Total", amountPaid: "Importe pagado", paymentCard: "Pagado con tarjeta", deliveredBy: "Entregado por" },
  it: { title: "Fattura cliente", orderRef: "Ordine", issuedOn: "Data", paidOn: "Pagato il", billedTo: "Cliente", item: "Articolo", quantity: "Qtà", unitPrice: "Prezzo unitario", amount: "Importo", exclVat: "Importo IVA esclusa", vat: "IVA", inclVat: "Totale IVA inclusa", total: "Totale", amountPaid: "Importo pagato", paymentCard: "Pagato con carta", deliveredBy: "Consegnato da" },
  nl: { title: "Klantfactuur", orderRef: "Bestelling", issuedOn: "Datum", paidOn: "Betaald op", billedTo: "Klant", item: "Artikel", quantity: "Aantal", unitPrice: "Stukprijs", amount: "Bedrag", exclVat: "Bedrag excl. btw", vat: "Btw", inclVat: "Totaal incl. btw", total: "Totaal", amountPaid: "Betaald bedrag", paymentCard: "Betaald met kaart", deliveredBy: "Geleverd door" },
  pl: { title: "Faktura dla klienta", orderRef: "Zamówienie", issuedOn: "Data", paidOn: "Zapłacono", billedTo: "Klient", item: "Produkt", quantity: "Ilość", unitPrice: "Cena jedn.", amount: "Kwota", exclVat: "Kwota netto", vat: "VAT", inclVat: "Razem brutto", total: "Razem", amountPaid: "Kwota zapłacona", paymentCard: "Zapłacono kartą", deliveredBy: "Dostarczone przez" },
}

export function resolveInvoiceLocale(buyerLocale: string | null | undefined): InvoiceLocale {
  const code = (buyerLocale ?? "").trim().toLowerCase().slice(0, 2)
  return code in LABELS ? (code as InvoiceLocale) : "fr"
}

export function invoiceLabels(locale: InvoiceLocale): InvoiceLabels {
  return LABELS[locale]
}

/** Address block of a checkout `shippingAddress` JSON: name, street lines, "postal city", country. */
export function invoiceAddressLines(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return []
  const a = raw as Record<string, unknown>
  const s = (k: string) => (typeof a[k] === "string" ? (a[k] as string).trim() : "")
  const cityLine = [s("postal_code"), s("city")].filter(Boolean).join(" ")
  return [s("name"), s("line1"), s("line2"), cityLine, s("state"), s("country")].filter(Boolean)
}
