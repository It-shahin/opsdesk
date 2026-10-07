export interface Customer {
  id:
    string;

  name:
    string;

  email:
    string | null;

  phone:
    string | null;

  company:
    string | null;

  notes:
    string | null;

  archivedAt:
    string | null;

  createdAt:
    string;

  updatedAt:
    string;
}

export interface CustomerListResponse {
  data:
    Customer[];

  pagination: {
    page:
      number;

    limit:
      number;

    total:
      number;

    totalPages:
      number;

    hasNextPage:
      boolean;

    hasPreviousPage:
      boolean;
  };
}

export type CustomerStatusFilter =
  | 'active'
  | 'archived'
  | 'all';