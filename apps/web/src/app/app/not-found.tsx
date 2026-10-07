import Link from 'next/link';

import {
  SearchX,
} from 'lucide-react';

import {
  buttonVariants,
} from '@/components/ui/button';

export default function NotFound() {
  return (
    <main
      className="flex min-h-screen items-center justify-center px-6"
    >
      <div
        className="max-w-md text-center"
      >
        <SearchX
          className="mx-auto size-10 text-muted-foreground"
        />

        <h1
          className="mt-5 text-2xl font-semibold"
        >
          Not found
        </h1>

        <p
          className="mt-2 text-sm text-muted-foreground"
        >
          This resource does not exist,
          or you do not have access to
          it.
        </p>

        <Link
          href="/app"
          className={buttonVariants({ className: 'mt-6' })}
        >
          Return to OpsDesk
        </Link>
      </div>
    </main>
  );
}
