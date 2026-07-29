import { redirect } from "next/navigation"

/** Alias historique → mentions auto-entreprise. */
export default function MentionsLegalesAliasPage() {
  redirect("/legal/mentions-legales")
}
