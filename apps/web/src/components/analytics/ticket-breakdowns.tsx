import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import type { AnalyticsOverview } from '@/lib/analytics/types';

export function TicketBreakdowns({
  analytics,
}: {
  analytics: AnalyticsOverview;
}) {
  const { total, byStatus, byPriority, bySource } = analytics.tickets;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <BreakdownCard
        title="Tickets by status"
        total={total}
        rows={[
          { label: 'Open', count: byStatus.OPEN },
          { label: 'Pending', count: byStatus.PENDING },
          { label: 'Resolved', count: byStatus.RESOLVED },
          { label: 'Closed', count: byStatus.CLOSED },
        ]}
      />
      <BreakdownCard
        title="Tickets by priority"
        total={total}
        rows={[
          { label: 'Low', count: byPriority.LOW },
          { label: 'Normal', count: byPriority.NORMAL },
          { label: 'High', count: byPriority.HIGH },
          { label: 'Urgent', count: byPriority.URGENT },
        ]}
      />
      <BreakdownCard
        title="Tickets by source"
        total={total}
        rows={[
          { label: 'Manual', count: bySource.MANUAL },
          { label: 'Email', count: bySource.EMAIL },
        ]}
      />
    </div>
  );
}

function BreakdownCard({
  title,
  total,
  rows,
}: {
  title: string;
  total: number;
  rows: Array<{ label: string; count: number }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-muted-foreground">
          Current totals across all tickets.
        </p>
      </CardHeader>
      <CardContent>
        {total === 0 && (
          <p className="mb-4 text-sm text-muted-foreground">No tickets yet.</p>
        )}
        <ul className="space-y-4">
          {rows.map(({ label, count }) => (
            <li key={label} className="grid grid-cols-2 gap-2">
              <span className="text-sm text-muted-foreground">{label}</span>
              <span className="text-right text-sm font-semibold tabular-nums">
                {count}
              </span>
              <div
                aria-hidden="true"
                className="col-span-2 h-2 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full rounded-full bg-foreground"
                  style={{ width: `${total === 0 ? 0 : (count / total) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
