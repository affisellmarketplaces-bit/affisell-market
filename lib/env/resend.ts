/** Resend-related env (server-only). */
export type ResendEnv = {
  apiKey: string
  fromEmail: string
  testEmailTo: string
}

export function readResendEnv(): ResendEnv {
  return {
    apiKey: process.env.RESEND_API_KEY?.trim() ?? "",
    fromEmail: process.env.RESEND_FROM_EMAIL?.trim() ?? "",
    testEmailTo: process.env.TEST_EMAIL_TO?.trim() ?? "",
  }
}
