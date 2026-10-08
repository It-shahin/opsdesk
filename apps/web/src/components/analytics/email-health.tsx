import {
  CheckCircle2,
  Clock3,
  MailWarning,
} from 'lucide-react';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import type {
  AnalyticsOverview,
} from '@/lib/analytics/types';

export function EmailHealth({
  email,
}: {
  email:
    AnalyticsOverview['email'];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Email delivery health
        </CardTitle>

        <p
          className="text-sm text-muted-foreground"
        >
          Outbound customer replies
          during the selected period.
        </p>
      </CardHeader>

      <CardContent
        className="grid gap-4 sm:grid-cols-3"
      >
        <Metric
          icon={
            CheckCircle2
          }
          label="Delivered"
          value={
            email.delivered
          }
          secondary={
            email.deliveryRatePercent ===
            null
              ? 'No completed deliveries'
              : `${email.deliveryRatePercent}% delivery rate`
          }
        />

        <Metric
          icon={
            MailWarning
          }
          label="Failed"
          value={
            email.failed
          }
          secondary={
            email.failureRatePercent ===
            null
              ? 'No completed deliveries'
              : `${email.failureRatePercent}% failure rate`
          }
        />

        <Metric
          icon={
            Clock3
          }
          label="In flight"
          value={
            email.inFlight
          }
          secondary="Pending, sending, sent or delayed"
        />
      </CardContent>
    </Card>
  );
}

function Metric({
  icon:
    Icon,
  label,
  value,
  secondary,
}: {
  icon:
    typeof CheckCircle2;

  label:
    string;

  value:
    number;

  secondary:
    string;
}) {
  return (
    <div
      className="rounded-lg border p-4"
    >
      <div
        className="flex items-center gap-2 text-sm text-muted-foreground"
      >
        <Icon
          className="size-4"
        />

        {label}
      </div>

      <p
        className="mt-3 text-2xl font-semibold"
      >
        {value}
      </p>

      <p
        className="mt-1 text-xs text-muted-foreground"
      >
        {secondary}
      </p>
    </div>
  );
}