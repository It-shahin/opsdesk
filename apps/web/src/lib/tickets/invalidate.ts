import type {
  QueryClient,
} from '@tanstack/react-query';

export async function invalidateTicketData(
  queryClient:
    QueryClient,

  organizationId:
    string,

  ticketId:
    string,
) {
  await Promise.all([
    queryClient
      .invalidateQueries({
        queryKey: [
          'ticket',
          organizationId,
          ticketId,
        ],
      }),

    queryClient
      .invalidateQueries({
        queryKey: [
          'tickets',
          organizationId,
        ],
      }),
  ]);
}