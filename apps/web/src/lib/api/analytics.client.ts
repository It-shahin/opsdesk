import {
  apiClientFetch,
} from './client';

import type {
  AnalyticsOverview,
  AnalyticsRange,
} from '@/lib/analytics/types';

export function getAnalyticsOverview(
  organizationId:
    string,

  range:
    AnalyticsRange,
) {
  const params =
    new URLSearchParams({
      range,
    });

  return apiClientFetch<
    AnalyticsOverview
  >(
    `/api/organizations/${organizationId}/analytics/overview?${params.toString()}`,
  );
}