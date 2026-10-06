import {
  Building2,
  CalendarDays,
  Mail,
  Phone,
  UserRound,
} from 'lucide-react';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';

import {
  Badge,
} from '@/components/ui/badge';

import {
  Separator,
} from '@/components/ui/separator';

import type {
  TicketDetail,
} from '@/lib/api/tickets.server';

import {
  formatTicketDate,
} from '@/lib/tickets/format';

export function TicketContext({
  ticket,
}: {
  ticket:
    TicketDetail;
}) {
  const assignee =
    ticket.assignee
      ?.user;

  return (
    <aside
      className="space-y-4"
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
            className="flex size-10 items-center justify-center rounded-full bg-muted"
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
              className="flex items-center gap-2 text-muted-foreground"
            >
              <Mail
                className="size-4"
              />

              <span
                className="truncate"
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
              className="flex items-center gap-2 text-muted-foreground"
            >
              <Phone
                className="size-4"
              />

              {
                ticket
                  .customer
                  .phone
              }
            </div>
          )}

          {ticket.customer
            .company && (
            <div
              className="flex items-center gap-2 text-muted-foreground"
            >
              <Building2
                className="size-4"
              />

              {
                ticket
                  .customer
                  .company
              }
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
          <Detail
            label="Status"
            value={
              ticket.status
            }
          />

          <Detail
            label="Priority"
            value={
              ticket.priority
            }
          />

          <Detail
            label="Source"
            value={
              ticket.source
            }
          />

          <Separator />

          <div>
            <p
              className="text-xs text-muted-foreground"
            >
              Assignee
            </p>

            {assignee ? (
              <div
                className="mt-2 flex items-center gap-2"
              >
                <Avatar
                  className="size-7"
                >
                  {assignee
                    .avatarUrl && (
                    <AvatarImage
                      src={
                        assignee
                          .avatarUrl
                      }
                    />
                  )}

                  <AvatarFallback>
                    {(assignee.name ??
                      assignee.email)
                      .slice(
                        0,
                        2,
                      )
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <span
                  className="truncate"
                >
                  {assignee.name ??
                    assignee.email}
                </span>
              </div>
            ) : (
              <p
                className="mt-1 text-muted-foreground"
              >
                Unassigned
              </p>
            )}
          </div>

          {ticket.tags.length >
            0 && (
            <>
              <Separator />

              <div>
                <p
                  className="text-xs text-muted-foreground"
                >
                  Tags
                </p>

                <div
                  className="mt-2 flex flex-wrap gap-1.5"
                >
                  {ticket.tags.map(
                    (
                      tag,
                    ) => (
                      <Badge
                        key={
                          tag.id
                        }
                        variant="outline"
                      >
                        {tag.name}
                      </Badge>
                    ),
                  )}
                </div>
              </div>
            </>
          )}

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