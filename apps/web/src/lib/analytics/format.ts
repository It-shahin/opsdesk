export function formatResolutionTime(
  minutes:
    number | null,
) {
  if (
    minutes ===
    null
  ) {
    return '—';
  }

  if (
    minutes <
    60
  ) {
    return `${Math.round(
      minutes,
    )}m`;
  }

  if (
    minutes <
    1440
  ) {
    const hours =
      minutes /
      60;

    return `${hours.toFixed(
      hours >= 10
        ? 0
        : 1,
    )}h`;
  }

  const days =
    minutes /
    1440;

  return `${days.toFixed(
    days >= 10
      ? 0
      : 1,
  )}d`;
}

export function formatChartDate(
  value:
    string,
) {
  const date =
    new Date(
      `${value}T00:00:00Z`,
    );

  return new Intl
    .DateTimeFormat(
      undefined,
      {
        month:
          'short',

        day:
          'numeric',

        timeZone:
          'UTC',
      },
    )
    .format(
      date,
    );
}