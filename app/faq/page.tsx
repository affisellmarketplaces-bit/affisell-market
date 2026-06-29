import { redirect } from "next/navigation"

/** Alias historique → FAQ acheteur `/help/faq`. */
export default function FaqAliasPage() {
  redirect("/help/faq")
}
