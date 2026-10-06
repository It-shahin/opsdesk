export function formatTicketDate(
  value:
    string,
) {
  return new Intl
    .DateTimeFormat(
      undefined,
      {
        dateStyle:
          'medium',

        timeStyle:
          'short',
      },
    )
    .format(
      new Date(
        value,
      ),
    );
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