import AgentLocalePage, { metadata as agentMetadata } from "@/app/[locale]/agent/page"

export const metadata = agentMetadata

/** English buyer agent at `/agent` (same pattern as `/creators`). */
export default function AgentPage() {
  return <AgentLocalePage params={Promise.resolve({ locale: "en" })} />
}
