interface BuildTicketReplyEmailInput {
  customerName:
    string;

  ticketSubject:
    string;

  body:
    string;
}

function escapeHtml(
  value: string,
): string {
  return value
    .replaceAll(
      '&',
      '&amp;',
    )
    .replaceAll(
      '<',
      '&lt;',
    )
    .replaceAll(
      '>',
      '&gt;',
    )
    .replaceAll(
      '"',
      '&quot;',
    )
    .replaceAll(
      "'",
      '&#039;',
    );
}

function buildSubject(
  subject: string,
): string {
  const trimmed =
    subject.trim();

  if (
    /^re:\s/i.test(
      trimmed,
    )
  ) {
    return trimmed;
  }

  return `Re: ${trimmed}`;
}

export function buildTicketReplyEmail(
  input:
    BuildTicketReplyEmailInput,
) {
  const customerName =
    escapeHtml(
      input.customerName,
    );

  const escapedBody =
    escapeHtml(
      input.body,
    ).replace(
      /\r?\n/g,
      '<br>',
    );

  const subject =
    buildSubject(
      input.ticketSubject,
    );

  const text =
    [
      `Hi ${input.customerName},`,
      '',
      input.body,
      '',
      '— OpsDesk Support',
    ].join(
      '\n',
    );

  const html =
    `
      <div>
        <p>Hi ${customerName},</p>

        <p>
          ${escapedBody}
        </p>

        <p>
          — OpsDesk Support
        </p>
      </div>
    `.trim();

  return {
    subject,
    text,
    html,
  };
}