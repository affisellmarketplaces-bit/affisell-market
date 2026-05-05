/** Payload returned by the shopping agent `searchProducts` tool (also used by product cards UI). */
export type AgentProductCard = {
  id: string
  name: string
  price: number
  imageUrl: string | null
  description: string
  brand: string
}

export type AgentSearchToolResult = {
  products: AgentProductCard[]
  /** Same shape as main cards; shown in a separate “similar” row in the UI. */
  similarProducts: AgentProductCard[]
  suggestedCategories: string[]
}
