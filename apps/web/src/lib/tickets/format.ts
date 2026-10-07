const ticketDateMonths = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sept',
  'Oct',
  'Nov',
  'Dec',
];

export function formatTicketDate(
  value:
    string,
) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new RangeError('Invalid ticket timestamp');
  }

  // Fixed month names and UTC avoid locale, ICU, and timezone differences
  // between the server render and the browser's first render.
  const day = date.getUTCDate();
  const month = ticketDateMonths[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');

  return `${day} ${month} ${year}, ${hours}:${minutes} UTC`;
}

export function formatFileSize(
  bytes:
    number,
) {
  if (
    bytes <
    1024
  ) {
    return `${bytes} B`;
  }

  const kb =
    bytes /
    1024;

  if (
    kb <
    1024
  ) {
    return `${kb.toFixed(
      1,
    )} KB`;
  }

  return `${(
    kb /
    1024
  ).toFixed(
    1,
  )} MB`;
}
