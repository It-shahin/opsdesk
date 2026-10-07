import {
  apiClientFetch,
} from './client';

import type {
  OrganizationRole,
} from '@/lib/organizations/types';

import type {
  CreatedInvitation,
  Invitation,
  InvitationAcceptanceResult,
  TeamMember,
} from '@/lib/team/types';

export function listMembers(
  organizationId:
    string,
) {
  return apiClientFetch<
    TeamMember[]
  >(
    `/api/organizations/${organizationId}/members`,
  );
}

export function updateMemberRole(
  organizationId:
    string,

  membershipId:
    string,

  role:
    OrganizationRole,
) {
  return apiClientFetch<
    TeamMember
  >(
    `/api/organizations/${organizationId}/members/${membershipId}/role`,
    {
      method:
        'PATCH',

      body:
        JSON.stringify({
          role,
        }),
    },
  );
}

export function listInvitations(
  organizationId:
    string,
) {
  return apiClientFetch<
    Invitation[]
  >(
    `/api/organizations/${organizationId}/invitations`,
  );
}

export function createInvitation(
  organizationId:
    string,

  input: {
    email:
      string;

    role:
      OrganizationRole;
  },
) {
  return apiClientFetch<
    CreatedInvitation
  >(
    `/api/organizations/${organizationId}/invitations`,
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

export function cancelInvitation(
  organizationId:
    string,

  invitationId:
    string,
) {
  return apiClientFetch<
    Invitation
  >(
    `/api/organizations/${organizationId}/invitations/${invitationId}`,
    {
      method:
        'DELETE',
    },
  );
}

export function acceptInvitation(
  token:
    string,
) {
  return apiClientFetch<
    InvitationAcceptanceResult
  >(
    '/api/invitations/accept',
    {
      method:
        'POST',

      body:
        JSON.stringify({
          token,
        }),
    },
  );
}