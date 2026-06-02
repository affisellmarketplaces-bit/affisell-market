export type FaqItem = { id: string; qKey: string; aKey: string }

export type FaqSection = { id: string; titleKey: string; items: FaqItem[] }

export const FAQ_SECTIONS: FaqSection[] = [
  {
    id: "orders",
    titleKey: "sectionOrders",
    items: [
      { id: "track", qKey: "trackQ", aKey: "trackA" },
      { id: "confirm", qKey: "confirmQ", aKey: "confirmA" },
      { id: "cancel", qKey: "cancelQ", aKey: "cancelA" },
    ],
  },
  {
    id: "shipping",
    titleKey: "sectionShipping",
    items: [
      { id: "delay", qKey: "delayQ", aKey: "delayA" },
      { id: "late", qKey: "lateQ", aKey: "lateA" },
    ],
  },
  {
    id: "returns",
    titleKey: "sectionReturns",
    items: [
      { id: "return", qKey: "returnQ", aKey: "returnA" },
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
    id: "perks",
    titleKey: "sectionPerks",
    items: [{ id: "cashback", qKey: "cashbackTitle", aKey: "cashbackBody" }],
  },
]
