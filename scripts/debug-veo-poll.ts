import "dotenv/config"
import { config } from "dotenv"

config({ path: ".env.local", override: true })

import { getVeoAccessToken } from "../lib/veo-auth"
import { getVeoConfig, veoOperationPollUrl, veoPredictLongRunning } from "../lib/veo-video"

async function main() {
  const cfg = getVeoConfig()
  const body = {
    instances: [{ prompt: "A ginger cat dancing in Paris, 4k, cinematic" }],
    parameters: { durationSeconds: 4, aspectRatio: "9:16", sampleCount: 1 },
  }
  const { operationName, raw } = await veoPredictLongRunning(cfg, body)
  console.log("operationName:", operationName)
  console.log("raw:", JSON.stringify(raw, null, 2))

  const token = await getVeoAccessToken()
  const url = veoOperationPollUrl(operationName)
  console.log("pollUrl:", url)
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  console.log("poll status:", res.status)
  console.log("poll body:", (await res.text()).slice(0, 600))

  const id = operationName.split("/").pop()!
  const alt = `https://us-central1-aiplatform.googleapis.com/v1/projects/affisell/locations/us-central1/operations/${id}`
  console.log("alt:", alt)
  const res2 = await fetch(alt, { headers: { Authorization: `Bearer ${token}` } })
  console.log("alt status:", res2.status)
  console.log("alt body:", (await res2.text()).slice(0, 600))
}

main().catch(console.error)
