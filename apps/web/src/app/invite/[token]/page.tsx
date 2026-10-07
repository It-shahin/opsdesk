import {
  redirect,
} from 'next/navigation';

import {
  InvitationAcceptance,
} from '@/components/team/invitation-acceptance';

import {
  auth0,
} from '@/lib/auth0';

type InvitePageProps = {
  params:
    Promise<{
      token:
        string;
    }>;
};

export default async function InvitePage({
  params,
}: InvitePageProps) {
  const {
    token,
  } =
    await params;

  const session =
    await auth0.getSession();

  if (
    !session
  ) {
    const returnTo =
      `/invite/${encodeURIComponent(
        token,
      )}`;

    redirect(
      `/auth/login?returnTo=${encodeURIComponent(
        returnTo,
      )}`,
    );
  }

  return (
    <InvitationAcceptance
      token={
        token
      }
    />
  );
}