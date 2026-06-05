export const SUPPORT_TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "SPAM"] as const

export type SupportTicketStatus = (typeof SUPPORT_TICKET_STATUSES)[number]

export function isSupportTicketStatus(value: string): value is SupportTicketStatus {
  return (SUPPORT_TICKET_STATUSES as readonly string[]).includes(value)
}
