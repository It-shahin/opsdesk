import {
  redirect,
} from 'next/navigation';

import {
  auth0,
} from '@/lib/auth0';

import {
  buttonVariants,
} from '@/components/ui/button';

export default async function Home() {
  const session =
    await auth0
      .getSession();

  if (
    session
  ) {
    redirect(
      '/app',
    );
  }

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-muted/20 px-6"
    >
      <div
        className="w-full max-w-lg text-center"
      >
        <div
          className="mx-auto flex size-12 items-center justify-center rounded-xl bg-foreground font-semibold text-background"
        >
          OD
        </div>

        <h1
          className="mt-6 text-4xl font-semibold tracking-tight"
        >
          Customer support,
          without the clutter.
        </h1>

        <p
          className="mx-auto mt-4 max-w-md text-muted-foreground"
        >
          OpsDesk brings customer
          conversations, tickets and
          team collaboration into one
          workspace.
        </p>

        <div
          className="mt-8 flex justify-center gap-3"
        >
          <a
            href="/auth/login"
            className={buttonVariants()}
          >
            Log in
          </a>

          <a
            href="/auth/login?screen_hint=signup"
            className={buttonVariants({ variant: 'outline' })}
          >
            Create account
          </a>
        </div>
      </div>
    </main>
  );
}
