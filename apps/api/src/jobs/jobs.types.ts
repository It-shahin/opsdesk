export interface EmailSmokeTestJob {
  requestedAt: string;
}

export interface SendTicketReplyJob {
  messageId: string;
  organizationId: string;
  ticketId: string;
}
