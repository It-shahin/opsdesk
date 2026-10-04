export function userRoom(
  userId: string,
): string {
  return `user:${userId}`;
}

export function organizationRoom(
  organizationId: string,
): string {
  return `organization:${organizationId}`;
}

export function ticketRoom(
  organizationId: string,
  ticketId: string,
): string {
  return (
    `ticket:${organizationId}:` +
    ticketId
  );
}