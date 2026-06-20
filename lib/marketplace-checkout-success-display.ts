export type CheckoutSuccessDisplay = {
  amountTotal: number | null
  currency: string
  productName: string | null
  productImageUrl: string | null
}

type OrderDisplayRow = {
  totalCents: number | null
  sellingPriceCents: number
  quantity: number
  variantLabel: string | null
  variantImageUrl: string | null
  currency: string
  productName: string
}

export function resolveCheckoutSuccessDisplay(args: {
  sessionAmountTotal: number | null | undefined
  sessionCurrency: string | null | undefined
  stripeLineDescription: string | null
  orders: OrderDisplayRow[]
}): CheckoutSuccessDisplay {
  const currency = (args.sessionCurrency ?? args.orders[0]?.currency ?? "eur").toLowerCase()

  let amountTotal =
    typeof args.sessionAmountTotal === "number" && args.sessionAmountTotal > 0
      ? args.sessionAmountTotal
      : null

  if (amountTotal == null && args.orders.length > 0) {
    const sum = args.orders.reduce((acc, order) => {
      const line =
        typeof order.totalCents === "number" && order.totalCents > 0
          ? order.totalCents
          : order.sellingPriceCents * Math.max(1, order.quantity)
      return acc + line
    }, 0)
    if (sum > 0) amountTotal = sum
  }

  let productName: string | null = null
  let productImageUrl: string | null = null

  if (args.orders.length === 1) {
    const order = args.orders[0]!
    const variant = order.variantLabel?.trim()
    productName = variant ? `${order.productName} · ${variant}` : order.productName
    productImageUrl = order.variantImageUrl?.trim() || null
  } else if (args.orders.length > 1) {
    productImageUrl = args.orders[0]?.variantImageUrl?.trim() || null
  } else if (args.stripeLineDescription?.trim()) {
    productName = args.stripeLineDescription.trim()
  }

  return { amountTotal, currency, productName, productImageUrl }
}
