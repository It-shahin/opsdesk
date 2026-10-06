'use client';

import {
  FormEvent,
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
      !trimmed
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
        setOpen
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
            aria-label={
              iconOnly
                ? 'Create workspace'
                : undefined
            }
          />
        }
      >
        <Plus
          className="size-4"
        />

        {!iconOnly &&
          'Create workspace'}
      </DialogTrigger>

      <DialogContent
        className="sm:max-w-md"
      >
        <form
          onSubmit={
            submit
          }
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
              htmlFor="organization-name"
            >
              Workspace name
            </Label>

            <Input
              id="organization-name"
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
              className="mt-2"
              autoFocus
              disabled={
                mutation.isPending
              }
            />

            {mutation.isError && (
              <p
                className="mt-2 text-sm text-destructive"
              >
                {mutation.error
                  .message}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={
                mutation.isPending ||
                !name.trim()
              }
            >
              {mutation.isPending && (
                <LoaderCircle
                  className="size-4 animate-spin"
                />
              )}

              Create workspace
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}