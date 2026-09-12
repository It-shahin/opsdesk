import { auth0 } from '@/lib/auth0';

export default async function Home() {
  const session = await auth0.getSession();

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="space-y-4 text-center">
          <h1 className="text-3xl font-semibold">OpsDesk</h1>

          <p className="text-muted-foreground">
            Customer support and CRM for small teams.
          </p>

          <div className="flex justify-center gap-3">
            <a
              href="/auth/login"
              className="rounded-md bg-black px-4 py-2 text-white"
            >
              Log in
            </a>

            <a
              href="/auth/login?screen_hint=signup"
              className="rounded-md border px-4 py-2"
            >
              Sign up
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="space-y-4 text-center">
        <h1 className="text-3xl font-semibold">
          Welcome, {session.user.name ?? session.user.email}
        </h1>

        <p>{session.user.email}</p>

        <a
          href="/auth/logout"
          className="inline-block rounded-md border px-4 py-2"
        >
          Log out
        </a>
      </div>
    </main>
  );
}