const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeEmailAddress(
  value: string,
): string {
  const trimmed =
    value.trim();

  const angleBracketMatch =
    trimmed.match(
      /<([^<>]+)>/,
    );

  return (
    angleBracketMatch?.[1] ??
    trimmed
  )
    .trim()
    .toLowerCase();
}

export function buildTicketReplyAddress(
  ticketId: string,
  inboundDomain: string,
): string {
  return (
    `ticket-${ticketId}` +
    `@${inboundDomain}`
  ).toLowerCase();
}

export function extractTicketIdFromRecipients(
  recipients: string[],
  inboundDomain: string,
): string | null {
  const domain =
    inboundDomain
      .trim()
      .toLowerCase();

  const suffix =
    `@${domain}`;

  for (
    const recipient
    of recipients
  ) {
    const address =
      normalizeEmailAddress(
        recipient,
      );

    if (
      !address.endsWith(
        suffix,
      )
    ) {
      continue;
    }

    const localPart =
      address.slice(
        0,
        -suffix.length,
      );

    const prefix =
      'ticket-';

    if (
      !localPart.startsWith(
        prefix,
      )
    ) {
      continue;
    }

    const ticketId =
      localPart.slice(
        prefix.length,
      );

    if (
      UUID_V4_PATTERN.test(
        ticketId,
      )
    ) {
      return ticketId;
    }
  }

  return null;
}