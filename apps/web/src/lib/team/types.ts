import type {
  OrganizationRole,
} from '@/lib/organizations/types';

export interface TeamMember {
  id:
    string;

  role:
    OrganizationRole;

  createdAt:
    string;

  updatedAt:
    string;

  user: {
    id:
      string;

    email:
      string;

    name:
      string | null;

    avatarUrl:
      string | null;
  };
}

export type InvitationStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'CANCELED'
  | 'EXPIRED';

export interface Invitation {
  id:
    string;

  email:
    string;

  role:
    OrganizationRole;

  expiresAt:
    string;

  acceptedAt:
    string | null;

  canceledAt:
    string | null;

  createdAt:
    string;

  updatedAt:
    string;

  status:
    InvitationStatus;

  invitedBy: {
    id:
      string;

    name:
      string | null;

    email:
      string;
  };
}

export interface CreatedInvitation
  extends Invitation {
  acceptanceToken:
    string;
}

export interface InvitationAcceptanceResult {
  membership: {
    id:
      string;

    role:
      OrganizationRole;

    createdAt:
      string;
  };

  organization: {
    id:
      string;

    name:
      string;

    slug:
      string;
  };

  invitation: {
    id:
      string;

    acceptedAt:
      string;
  };
}