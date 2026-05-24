import { defineConfig } from "prisma/config"
import { ensureDirectUrl } from "./scripts/ensure-direct-url.mjs"

ensureDirectUrl()

export default defineConfig({
  schema: "prisma/schema.prisma",
})
