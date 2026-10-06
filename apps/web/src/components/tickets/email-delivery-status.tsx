import {
  AlertCircle,
  Check,
  CheckCheck,
  Clock,
  Send,
} from 'lucide-react';

import type {
  EmailDeliveryStatus,
} from '@/lib/tickets/types';

export function EmailDeliveryStatusLabel({
  status,
}: {
  status:
    EmailDeliveryStatus;
}) {
  switch (
    status
  ) {
    case 'PENDING':
      return (
        <Status
          icon={
            Clock
          }
          label="Queued"
        />
      );

    case 'SENDING':
      return (
        <Status
          icon={
            Send
          }
          label="Sending"
        />
      );

    case 'SENT':
    case 'DELAYED':
      return (
        <Status
          icon={
            Check
          }
          label={
            status ===
            'DELAYED'
              ? 'Delayed'
              : 'Sent'
          }
        />
      );

    case 'DELIVERED':
      return (
        <Status
          icon={
            CheckCheck
          }
          label="Delivered"
        />
      );

    default:
      return (
        <Status
          icon={
            AlertCircle
          }
          label={
            status
              .toLowerCase()
              .replaceAll(
                '_',
                ' ',
              )
          }
        />
      );
  }
}

function Status({
  icon:
    Icon,

  label,
}: {
  icon:
    typeof Clock;

  label:
    string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-muted-foreground"
    >
      <Icon
        className="size-3.5"
      />

      {label}
    </span>
  );
}