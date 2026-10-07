import {
  Building2,
  CalendarDays,
  Mail,
  Phone,
  UserRound,
} from 'lucide-react';

import {
  Separator,
} from '@/components/ui/separator';

import type {
  TicketDetail,
} from '@/lib/api/tickets.server';

import {
  formatTicketDate,
} from '@/lib/tickets/format';

import {
  TicketControls,
} from '@/lib/tickets/ticket-controls';

export function TicketContext({
  organizationId,
  ticket,
  canWrite,
}: {
  organizationId:
    string;

  ticket:
    TicketDetail;

  canWrite:
    boolean;
}) {
  return (
    <aside
      className="min-w-0 space-y-4"
    >
      <section
        className="rounded-xl border bg-background p-5"
      >
        <h2
          className="text-sm font-semibold"
        >
          Customer
        </h2>

        <div
          className="mt-4 flex items-center gap-3"
        >
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted"
          >
            <UserRound
              className="size-4"
            />
          </div>

          <div
            className="min-w-0"
          >
            <p
              className="truncate text-sm font-medium"
            >
              {ticket.customer.name}
            </p>

            {ticket.customer
              .company && (
              <p
                className="truncate text-xs text-muted-foreground"
              >
                {
                  ticket
                    .customer
                    .company
                }
              </p>
            )}
          </div>
        </div>

        <div
          className="mt-4 space-y-2 text-sm"
        >
          {ticket.customer
            .email && (
            <div
              className="flex min-w-0 items-center gap-2 text-muted-foreground"
            >
              <Mail
                className="size-4 shrink-0"
              />

              <span
                className="min-w-0 truncate"
              >
                {
                  ticket
                    .customer
                    .email
                }
              </span>
            </div>
          )}

          {ticket.customer
            .phone && (
            <div
              className="flex min-w-0 items-center gap-2 text-muted-foreground"
            >
              <Phone
                className="size-4 shrink-0"
              />

              <span
                className="min-w-0 [overflow-wrap:anywhere]"
              >
                {ticket.customer.phone}
              </span>
            </div>
          )}

          {ticket.customer
            .company && (
            <div
              className="flex min-w-0 items-center gap-2 text-muted-foreground"
            >
              <Building2
                className="size-4 shrink-0"
              />

              <span
                className="min-w-0 [overflow-wrap:anywhere]"
              >
                {ticket.customer.company}
              </span>
            </div>
          )}
        </div>
      </section>

      <section
        className="rounded-xl border bg-background p-5"
      >
        <h2
          className="text-sm font-semibold"
        >
          Ticket details
        </h2>

        <div
          className="mt-4 space-y-4 text-sm"
        >
          <TicketControls
            organizationId={
              organizationId
            }
            ticket={
              ticket
            }
            canWrite={
              canWrite
            }
          />

          <Separator />

          <Detail
            label="Source"
            value={
              ticket.source
            }
          />

          <Separator />

          <div
            className="space-y-2"
          >
            <div
              className="flex items-start gap-2 text-muted-foreground"
            >
              <CalendarDays
                className="mt-0.5 size-4"
              />

              <div>
                <p
                  className="text-xs"
                >
                  Created
                </p>

                <p
                  className="text-sm text-foreground"
                >
                  {formatTicketDate(
                    ticket.createdAt,
                  )}
                </p>
              </div>
            </div>

            <div
              className="flex items-start gap-2 text-muted-foreground"
            >
              <CalendarDays
                className="mt-0.5 size-4"
              />

              <div>
                <p
                  className="text-xs"
                >
                  Last updated
                </p>

                <p
                  className="text-sm text-foreground"
                >
                  {formatTicketDate(
                    ticket.updatedAt,
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </aside>
  );
}

function Detail({
  label,
  value,
}: {
  label:
    string;

  value:
    string;
}) {
  return (
    <div
      className="flex items-center justify-between gap-4"
    >
      <span
        className="text-muted-foreground"
      >
        {label}
      </span>

      <span
        className="font-medium"
      >
        {value}
      </span>
    </div>
  );
}
