'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import {
  formatChartDate,
} from '@/lib/analytics/format';

import type {
  AnalyticsOverview,
} from '@/lib/analytics/types';

export function TicketVolumeChart({
  data,
}: {
  data:
    AnalyticsOverview['ticketVolume'];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Ticket volume
        </CardTitle>

        <p
          className="text-sm text-muted-foreground"
        >
          Created and resolved tickets
          during the selected period.
        </p>
      </CardHeader>

      <CardContent>
        <div
          className="h-80 w-full"
        >
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <LineChart
              data={
                data
              }
              margin={{
                top:
                  8,

                right:
                  8,

                left:
                  -16,

                bottom:
                  0,
              }}
            >
              <CartesianGrid
                vertical={
                  false
                }
                strokeDasharray="3 3"
              />

              <XAxis
                dataKey="date"
                tickFormatter={
                  formatChartDate
                }
                minTickGap={
                  24
                }
                tickLine={
                  false
                }
                axisLine={
                  false
                }
                fontSize={
                  12
                }
              />

              <YAxis
                allowDecimals={
                  false
                }
                tickLine={
                  false
                }
                axisLine={
                  false
                }
                fontSize={
                  12
                }
              />

              <Tooltip
                labelFormatter={
                  (
                    value,
                  ) =>
                    formatChartDate(
                      String(
                        value,
                      ),
                    )
                }
              />

              <Line
                type="monotone"
                dataKey="created"
                name="Created"
                stroke="var(--foreground)"
                strokeWidth={
                  2
                }
                dot={
                  false
                }
              />

              <Line
                type="monotone"
                dataKey="resolved"
                name="Resolved"
                stroke="var(--muted-foreground)"
                strokeWidth={
                  2
                }
                strokeDasharray="5 5"
                dot={
                  false
                }
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}