import {
  apiClientFetch,
} from './client';

import type {
  Customer,
  CustomerListResponse,
  CustomerStatusFilter,
} from '@/lib/customers/types';

export function listCustomers(
  organizationId:
    string,

  filters: {
    page:
      number;

    search?:
      string;

    company?:
      string;

    status:
      CustomerStatusFilter;
  },
) {
  const params =
    new URLSearchParams();

  params.set(
    'page',
    String(
      filters.page,
    ),
  );

  params.set(
    'limit',
    '20',
  );

  params.set(
    'status',
    filters.status,
  );

  if (
    filters.search
  ) {
    params.set(
      'search',
      filters.search,
    );
  }

  if (
    filters.company
  ) {
    params.set(
      'company',
      filters.company,
    );
  }

  return apiClientFetch<
    CustomerListResponse
  >(
    `/api/organizations/${organizationId}/customers?${params.toString()}`,
  );
}

export function getCustomerClient(
  organizationId:
    string,

  customerId:
    string,
) {
  return apiClientFetch<
    Customer
  >(
    `/api/organizations/${organizationId}/customers/${customerId}`,
  );
}

export function createCustomer(
  organizationId:
    string,

  input: {
    name:
      string;

    email?:
      string;

    phone?:
      string;

    company?:
      string;

    notes?:
      string;
  },
) {
  return apiClientFetch<
    Customer
  >(
    `/api/organizations/${organizationId}/customers`,
    {
      method:
        'POST',

      body:
        JSON.stringify(
          input,
        ),
    },
  );
}

export function updateCustomer(
  organizationId:
    string,

  customerId:
    string,

  input: {
    name?:
      string;

    email?:
      string | null;

    phone?:
      string | null;

    company?:
      string | null;

    notes?:
      string | null;
  },
) {
  return apiClientFetch<
    Customer
  >(
    `/api/organizations/${organizationId}/customers/${customerId}`,
    {
      method:
        'PATCH',

      body:
        JSON.stringify(
          input,
        ),
    },
  );
}

export function archiveCustomer(
  organizationId:
    string,

  customerId:
    string,
) {
  return apiClientFetch<
    Customer
  >(
    `/api/organizations/${organizationId}/customers/${customerId}/archive`,
    {
      method:
        'POST',
    },
  );
}

export function restoreCustomer(
  organizationId:
    string,

  customerId:
    string,
) {
  return apiClientFetch<
    Customer
  >(
    `/api/organizations/${organizationId}/customers/${customerId}/restore`,
    {
      method:
        'POST',
    },
  );
}