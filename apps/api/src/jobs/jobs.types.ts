export interface EmailSmokeTestJob {
  requestedAt: string;
}

export interface SendTicketReplyJob {
  emailDeliveryId: string;
}

export interface RecoverEmailDeliveriesJob {
  requestedAt: string;
}

export interface CleanupAttachmentsJob {
  scheduled:
    true;
}