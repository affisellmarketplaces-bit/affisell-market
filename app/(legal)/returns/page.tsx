import { redirect } from "next/navigation"

/** Page acheteur B2C — politique simplifiée (ex-refund-policy markdown). */
export default function ReturnsBuyerPage() {
  redirect("/protected-checkout")
}
