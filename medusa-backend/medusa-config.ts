import { loadEnv, defineConfig } from "@medusajs/framework/utils"

loadEnv(process.env.NODE_ENV ?? "development", process.cwd())

const stripeApiKey = process.env.STRIPE_API_KEY?.trim()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const modules: any[] = [
  {
    resolve: "./src/modules/product-try-on",
  },
]

if (stripeApiKey) {
  modules.push({
    resolve: "@medusajs/medusa/payment",
    options: {
      providers: [
        {
          resolve: "@medusajs/medusa/payment-stripe",
          id: "stripe",
          options: {
            apiKey: stripeApiKey,
            webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
            capture: true,
            automaticPaymentMethods: true,
          },
        },
      ],
    },
  })
} else {
  console.warn(
    "[medusa-config] STRIPE_API_KEY unset — payment-stripe module skipped (try-on dev OK)"
  )
}

export default defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS ?? "http://localhost:3001,http://localhost:3002",
      adminCors: process.env.ADMIN_CORS ?? "http://localhost:9000,http://localhost:7001",
      authCors: process.env.AUTH_CORS ?? "http://localhost:9000,http://localhost:7001",
      jwtSecret: process.env.JWT_SECRET ?? "supersecret",
      cookieSecret: process.env.COOKIE_SECRET ?? "supersecret",
    },
  },
  admin: {
    path: "/app",
  },
  modules,
})
