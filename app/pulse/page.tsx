import { redirect } from "next/navigation"

/** /pulse → Discover (Pulse feed). Battle lives at /pulse/battle. */
export default function PulseIndexRedirect() {
  redirect("/discover")
}
