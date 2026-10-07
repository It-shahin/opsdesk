'use client';

import {
  AlertTriangle,
} from 'lucide-react';

import {
  Button,
} from '@/components/ui/button';

export default function AppError({
  error,
  reset,
}: {
  error:
    Error & {
      digest?:
        string;
    };

  reset:
    () => void;
}) {
  return (
    <div
      className="flex min-h-[60vh] items-center justify-center"
    >
      <div
        className="max-w-md text-center"
      >
        <div
          className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted"
        >
          <AlertTriangle
            className="size-5"
          />
        </div>

        <h1
          className="mt-4 text-xl font-semibold"
        >
          Something went wrong
        </h1>

        <p
          className="mt-2 text-sm text-muted-foreground"
        >
          OpsDesk could not load this
          part of the workspace.
        </p>

        <Button
          className="mt-5"
          onClick={
            reset
          }
        >
          Try again
        </Button>

        {process.env.NODE_ENV ===
          'development' && (
          <p
            className="mt-4 break-words text-xs text-muted-foreground"
          >
            {error.message}
          </p>
        )}
      </div>
    </div>
  );
}