import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';

import {
  Badge,
} from '@/components/ui/badge';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import type {
  AnalyticsOverview,
} from '@/lib/analytics/types';

function initials(
  value:
    string,
) {
  return value
    .split(' ')
    .map(
      (
        part,
      ) =>
        part[0],
    )
    .join('')
    .slice(
      0,
      2,
    )
    .toUpperCase();
}

export function TeamWorkload({
  workload,
}: {
  workload:
    AnalyticsOverview['workload'];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Team workload
        </CardTitle>

        <p
          className="text-sm text-muted-foreground"
        >
          Current OPEN and PENDING
          assigned tickets.
        </p>
      </CardHeader>

      <CardContent
        className="space-y-1"
      >
        {workload.length ===
        0 ? (
          <p
            className="py-8 text-center text-sm text-muted-foreground"
          >
            No assignable team members.
          </p>
        ) : (
          workload.map(
            (
              member,
            ) => {
              const name =
                member.user
                  .name ??
                member.user
                  .email;

              return (
                <div
                  key={
                    member.membershipId
                  }
                  className="flex items-center gap-3 rounded-lg px-2 py-3"
                >
                  <Avatar
                    className="size-9"
                  >
                    {member.user
                      .avatarUrl && (
                      <AvatarImage
                        src={
                          member.user
                            .avatarUrl
                        }
                        alt={
                          name
                        }
                      />
                    )}

                    <AvatarFallback>
                      {initials(
                        name,
                      )}
                    </AvatarFallback>
                  </Avatar>

                  <div
                    className="min-w-0 flex-1"
                  >
                    <p
                      className="truncate text-sm font-medium"
                    >
                      {name}
                    </p>

                    <p
                      className="text-xs text-muted-foreground"
                    >
                      {member.role}
                    </p>
                  </div>

                  <div
                    className="flex items-center gap-2"
                  >
                    <Badge
                      variant="outline"
                    >
                      {member.openTickets}{' '}
                      open
                    </Badge>

                    <Badge
                      variant="secondary"
                    >
                      {member.pendingTickets}{' '}
                      pending
                    </Badge>

                    <span
                      className="w-8 text-right text-sm font-semibold"
                    >
                      {member.activeTickets}
                    </span>
                  </div>
                </div>
              );
            },
          )
        )}
      </CardContent>
    </Card>
  );
}