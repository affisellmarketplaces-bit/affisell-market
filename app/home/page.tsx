import { redirect } from "next/navigation"

/** Legacy alias — bookmarks and back navigation may use `/home`. */
export default function HomeAliasPage() {
  redirect("/")
}
