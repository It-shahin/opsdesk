'use client';

import {
  type FormEvent,
  useId,
  useState,
} from 'react';

import {
  useMutation,
} from '@tanstack/react-query';

import {
  LoaderCircle,
  Plus,
} from 'lucide-react';

import {
  useRouter,
} from 'next/navigation';

import {
  Button,
} from '@/components/ui/button';

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

import {
  Input,
} from '@/components/ui/input';

import {
  Label,
} from '@/components/ui/label';

import {
  createOrganization,
  setActiveOrganizationPreference,
} from '@/lib/api/organizations.client';

export function CreateOrganizationDialog({
  iconOnly =
    false,
}: {
  iconOnly?:
    boolean;
}) {
  const router =
    useRouter();

  const nameId = useId();
  const errorId = `${nameId}-error`;

  const [
    open,
    setOpen,
  ] =
    useState(
      false,
    );

  const [
    name,
    setName,
  ] =
    useState(
      '',
    );

  const mutation =
    useMutation({
      mutationFn:
        async (
          organizationName:
            string,
        ) => {
          const organization =
            await createOrganization(
              organizationName,
            );

          await setActiveOrganizationPreference(
            organization.id,
          );

          return organization;
        },

      onSuccess:
        (
          organization,
        ) => {
          setOpen(
            false,
          );

          setName(
            '',
          );

          router.push(
            `/app/${organization.id}`,
          );

          router.refresh();
        },
    });

  function submit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const trimmed =
      name.trim();

    if (
      mutation.isPending ||
      trimmed.length < 2 ||
      trimmed.length > 80
    ) {
      return;
    }

    mutation.mutate(
      trimmed,
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={
        (nextOpen, details) => {
          if (mutation.isPending) {
            details.cancel();
            return;
          }

          if (nextOpen) {
            mutation.reset();
            setName('');
          }

          setOpen(nextOpen);
        }
      }
    >
      <DialogTrigger
        render={
          <Button
            variant={
              iconOnly
                ? 'outline'
                : 'default'
            }
            size={
              iconOnly
                ? 'icon'
                : 'default'
            }
            className={
              iconOnly
                ? 'size-10 shrink-0'
                : undefined
            }
            title={
              iconOnly
                ? 'Create workspace'
                : undefined
            }
            aria-label={
              iconOnly
                ? 'Create workspace'
                : undefined
            }
          />
        }
      >
        <Plus
          aria-hidden="true"
          className="size-4"
        />

        {!iconOnly &&
          'Create workspace'}
      </DialogTrigger>

      <DialogContent
        className="sm:max-w-md"
        showCloseButton={!mutation.isPending}
      >
        <form
          onSubmit={
            submit
          }
          aria-busy={mutation.isPending}
        >
          <DialogHeader>
            <DialogTitle>
              Create workspace
            </DialogTitle>

            <DialogDescription>
              Create an organization
              for your customers,
              tickets and team.
            </DialogDescription>
          </DialogHeader>

          <div
            className="py-6"
          >
            <Label
              htmlFor={nameId}
            >
              Workspace name
            </Label>

            <Input
              id={nameId}
              value={name}
              onChange={
                (
                  event,
                ) =>
                  setName(
                    event.target
                      .value,
                  )
              }
              placeholder="Acme Support"
              className="mt-2 h-10"
              required
              minLength={2}
              maxLength={80}
              aria-invalid={mutation.isError}
              aria-describedby={
                mutation.isError
                  ? errorId
                  : undefined
              }
              disabled={
                mutation.isPending
              }
            />

            {mutation.isError && (
              <p
                id={errorId}
                role="alert"
                className="mt-2 break-words text-sm text-destructive"
              >
                {mutation.error
                  .message}
              </p>
            )}
          </div>

          <DialogFooter>
            <DialogClose
              disabled={mutation.isPending}
              render={
                <Button
                  type="button"
                  variant="outline"
                />
              }
            >
              Cancel
            </DialogClose>

            <Button
              type="submit"
              disabled={
                mutation.isPending ||
                name.trim().length < 2 ||
                name.trim().length > 80
              }
            >
              {mutation.isPending && (
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin"
                />
              )}

              {mutation.isPending
                ? 'Creating workspace...'
                : 'Create workspace'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
