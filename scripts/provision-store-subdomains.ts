/**
 * One-shot: register *.shops.affisell.com + pending store subdomains on Vercel.
 * Run: npm run provision:store-subdomains
 */
process.env.AFFISELL_STORE_HOST_SUFFIX ??= "shops.affisell.com"

import { syncPendingStoreSubdomains } from "@/lib/store-subdomain-provisioning"

async function main() {
  const batch = await syncPendingStoreSubdomains(200)
  console.log(JSON.stringify(batch, null, 2))
  if (batch.failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error("[provision:store-subdomains]", e)
  process.exit(1)
})
