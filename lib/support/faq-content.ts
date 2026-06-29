export type FaqItem = {
  id: string
  qKey: string
  aKey: string
  /** Use `t.rich` on the page for answers with inline links. */
  richAnswer?: boolean
}

export type FaqSection = { id: string; titleKey: string; items: FaqItem[] }

/** Buyer-only FAQ — no supplier / affiliate / remuneration topics. */
export const FAQ_SECTIONS: FaqSection[] = [
  {
    id: "orders",
    titleKey: "sectionOrders",
    items: [
      { id: "seller", qKey: "sellerQ", aKey: "sellerA" },
      { id: "track", qKey: "trackQ", aKey: "trackA" },
      { id: "confirm", qKey: "confirmQ", aKey: "confirmA" },
      { id: "cancel", qKey: "cancelQ", aKey: "cancelA" },
      { id: "delay", qKey: "delayQ", aKey: "delayA" },
      { id: "late", qKey: "lateQ", aKey: "lateA" },
    ],
  },
  {
    id: "returns",
    titleKey: "sectionReturns",
    items: [
      { id: "return", qKey: "returnQ", aKey: "returnA", richAnswer: true },
      { id: "return-refused", qKey: "returnRefusedQ", aKey: "returnRefusedA", richAnswer: true },
      { id: "refund", qKey: "refundQ", aKey: "refundA" },
      { id: "defect", qKey: "defectQ", aKey: "defectA" },
    ],
  },
  {
    id: "payment",
    titleKey: "sectionPayment",
    items: [
      { id: "methods", qKey: "methodsQ", aKey: "methodsA" },
      { id: "failed", qKey: "failedQ", aKey: "failedA" },
    ],
  },
  {
    id: "account",
    titleKey: "sectionAccount",
    items: [
      { id: "cashback", qKey: "cashbackQ", aKey: "cashbackA" },
      { id: "login", qKey: "loginQ", aKey: "loginA" },
    ],
  },
]

export const L221_28_LEGIFRANCE_URL =
  "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006296033/"
