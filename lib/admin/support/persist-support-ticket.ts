import type { SupportTicketStatus } from "@/lib/admin/support-ticket-shared"
import { prisma } from "@/lib/prisma"

export type PersistSupportTicketInput = {
  ticketRef: string
  name: string
  email: string
  subject: string
  message: string
  status?: SupportTicketStatus
}

/** Idempotent on ticketRef — safe if contact email retry replays same ref. */
export async function persistSupportTicket(input: PersistSupportTicketInput) {
  return prisma.supportTicket.upsert({
    where: { ticketRef: input.ticketRef },
    create: {
      ticketRef: input.ticketRef,
      name: input.name.slice(0, 120),
      email: input.email.slice(0, 254),
      subject: input.subject.slice(0, 200),
      message: input.message.slice(0, 5000),
      status: input.status ?? "OPEN",
    },
    update: {},
  })
}
