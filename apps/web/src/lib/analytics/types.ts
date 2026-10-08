export type AnalyticsRange =
  | '7d'
  | '30d'
  | '90d';

export interface AnalyticsOverview {
  range: {
    preset:
      AnalyticsRange;

    timezone:
      string;

    from:
      string;

    to:
      string;

    days:
      number;
  };

  tickets: {
    total:
      number;

    active:
      number;

    open:
      number;

    pending:
      number;

    resolved:
      number;

    closed:
      number;

    urgentActive:
      number;

    unassignedActive:
      number;

    createdInPeriod:
      number;

    resolvedInPeriod:
      number;

    averageResolutionMinutes:
      number | null;

    byStatus: {
      OPEN:
        number;

      PENDING:
        number;

      RESOLVED:
        number;

      CLOSED:
        number;
    };

    byPriority: {
      LOW:
        number;

      NORMAL:
        number;

      HIGH:
        number;

      URGENT:
        number;
    };

    bySource: {
      MANUAL:
        number;

      EMAIL:
        number;
    };
  };

  ticketVolume:
    Array<{
      date:
        string;

      created:
        number;

      resolved:
        number;
    }>;

  customers: {
    total:
      number;

    active:
      number;

    archived:
      number;

    createdInPeriod:
      number;
  };

  workload:
    Array<{
      membershipId:
        string;

      role:
        string;

      user: {
        id:
          string;

        name:
          string | null;

        email:
          string;

        avatarUrl:
          string | null;
      };

      openTickets:
        number;

      pendingTickets:
        number;

      activeTickets:
        number;
    }>;

  email: {
    totalInPeriod:
      number;

    delivered:
      number;

    failed:
      number;

    inFlight:
      number;

    deliveryRatePercent:
      number | null;

    failureRatePercent:
      number | null;

    byStatus: {
      PENDING:
        number;

      SENDING:
        number;

      SENT:
        number;

      DELAYED:
        number;

      DELIVERED:
        number;

      BOUNCED:
        number;

      COMPLAINED:
        number;

      SUPPRESSED:
        number;

      FAILED:
        number;
    };
  };
}