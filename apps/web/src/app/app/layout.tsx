import {
  redirect,
} from 'next/navigation';

import {
  AppShell,
} from '@/components/app-shell/app-shell';

import {
  getCurrentUser,
} from '@/lib/api/current-user';

import {
  auth0,
} from '@/lib/auth0';

export const dynamic =
  'force-dynamic';

export default async function AppLayout({
  children,
}: Readonly<{
  children:
    React.ReactNode;
}>) {
  const session =
    await auth0
      .getSession();

  if (!session) {
    redirect(
      '/auth/login?returnTo=/app',
    );
  }

  const user =
    await getCurrentUser();

  return (
    <AppShell
      user={user}
    >
      {children}
    </AppShell>
  );
}