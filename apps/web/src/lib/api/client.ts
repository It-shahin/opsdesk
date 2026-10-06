export class ApiClientError
  extends Error {
  constructor(
    public readonly status:
      number,

    message:
      string,
  ) {
    super(
      message,
    );

    this.name =
      'ApiClientError';
  }
}

export async function apiClientFetch<
  T,
>(
  path:
    string,

  init:
    RequestInit = {},
): Promise<T> {
  const headers =
    new Headers(
      init.headers,
    );

  if (
    init.body &&
    !headers.has(
      'Content-Type',
    )
  ) {
    headers.set(
      'Content-Type',
      'application/json',
    );
  }

  const response =
    await fetch(
      path,
      {
        ...init,
        headers,
      },
    );

  if (
    response.status ===
    204
  ) {
    return undefined as T;
  }

  const data:
    unknown =
    await response
      .json()
      .catch(
        () => null,
      );

  if (
    !response.ok
  ) {
    let message =
      'Request failed';

    if (
      data &&
      typeof data ===
        'object'
    ) {
      const candidate =
        data as {
          message?:
            unknown;

          error?:
            unknown;
        };

      if (
        typeof candidate
          .message ===
        'string'
      ) {
        message =
          candidate.message;
      } else if (
        typeof candidate
          .error ===
        'string'
      ) {
        message =
          candidate.error;
      }
    }

    throw new ApiClientError(
      response.status,
      message,
    );
  }

  return data as T;
}