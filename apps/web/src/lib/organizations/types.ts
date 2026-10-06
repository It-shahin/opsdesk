export type OrganizationRole =
  | 'OWNER'
  | 'ADMIN'
  | 'AGENT'
  | 'VIEWER';

export interface Organization {
  id:
    string;

  name:
    string;

  slug:
    string;

  role:
    OrganizationRole;

  createdAt:
    string;

  updatedAt:
    string;
}