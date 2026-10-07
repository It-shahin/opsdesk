import 'server-only';

import {
  apiServerFetch,
} from './server';

import type {
  Customer,
} from '@/lib/customers/types';

export function getCustomer(
  organizationId:
    string,

  customerId:
    string,
) {
  return apiServerFetch<
    Customer
  >(
    `/v1/organizations/${organizationId}/customers/${customerId}`,
  );
}