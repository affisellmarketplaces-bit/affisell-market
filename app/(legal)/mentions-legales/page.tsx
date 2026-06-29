import { redirect } from "next/navigation"

/** Alias historique → page canonique `/legal/mentions`. */
export default function MentionsLegalesAliasPage() {
  redirect("/legal/mentions")
}
