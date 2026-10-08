'use client';

import {
  toast,
} from 'sonner';

import {
  FormEvent,
  useState,
} from 'react';

import {
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import {
  LoaderCircle,
  Pencil,
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
  Textarea,
} from '@/components/ui/textarea';

import {
  createCustomer,
  updateCustomer,
} from '@/lib/api/customers.client';

import type {
  Customer,
} from '@/lib/customers/types';

export function CustomerFormDialog({
  organizationId,
  customer,
}: {
  organizationId:
    string;

  customer?:
    Customer;
}) {
  const router =
    useRouter();

  const queryClient =
    useQueryClient();

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
      customer?.name ??
        '',
    );

  const [
    email,
    setEmail,
  ] =
    useState(
      customer?.email ??
        '',
    );

  const [
    phone,
    setPhone,
  ] =
    useState(
      customer?.phone ??
        '',
    );

  const [
    company,
    setCompany,
  ] =
    useState(
      customer?.company ??
        '',
    );

  const [
    notes,
    setNotes,
  ] =
    useState(
      customer?.notes ??
        '',
    );

  const editing =
    Boolean(
      customer,
    );

  const mutation =
    useMutation({
      mutationFn:
        async () => {
          if (
            customer
          ) {
            return updateCustomer(
              organizationId,
              customer.id,
              {
                name:
                  name.trim(),

                email:
                  email.trim() ||
                  null,

                phone:
                  phone.trim() ||
                  null,

                company:
                  company.trim() ||
                  null,

                notes:
                  notes.trim() ||
                  null,
              },
            );
          }

          return createCustomer(
            organizationId,
            {
              name:
                name.trim(),

              ...(email.trim()
                ? {
                    email:
                      email.trim(),
                  }
                : {}),

              ...(phone.trim()
                ? {
                    phone:
                      phone.trim(),
                  }
                : {}),

              ...(company.trim()
                ? {
                    company:
                      company.trim(),
                  }
                : {}),

              ...(notes.trim()
                ? {
                    notes:
                      notes.trim(),
                  }
                : {}),
            },
          );
        },

      onSuccess:
        async (
          saved,
        ) => {
          await Promise.all([
            queryClient
              .invalidateQueries({
                queryKey: [
                  'analytics',
                  organizationId,
                ],
              }),

            queryClient
              .invalidateQueries({
                queryKey: [
                  'customers',
                  organizationId,
                ],
              }),

            queryClient
              .invalidateQueries({
                queryKey: [
                  'customer',
                  organizationId,
                  saved.id,
                ],
              }),
          ]);

          setOpen(
            false,
          );

          toast.success(
            editing
              ? 'Customer updated'
              : 'Customer created',
          );

          if (
            !editing
          ) {
            router.push(
              `/app/${organizationId}/customers/${saved.id}`,
            );
          }
        },

      onError:
        (error) => {
          toast.error(
            error.message,
          );
        },
    });

  function submit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !name.trim()
    ) {
      return;
    }

    mutation.mutate();
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
              editing
                ? 'outline'
                : 'default'
            }
            size="sm"
          />
        }
      >
        {editing ? (
          <Pencil
            className="size-4"
          />
        ) : (
          <Plus
            className="size-4"
          />
        )}

        {editing
          ? 'Edit'
          : 'New customer'}
      </DialogTrigger>

      <DialogContent
        className="sm:max-w-lg"
      >
        <form
          onSubmit={
            submit
          }
        >
          <DialogHeader>
            <DialogTitle>
              {editing
                ? 'Edit customer'
                : 'Create customer'}
            </DialogTitle>

            <DialogDescription>
              {editing
                ? 'Update customer information.'
                : 'Add a customer to this workspace.'}
            </DialogDescription>
          </DialogHeader>

          <div
            className="space-y-4 py-6"
          >
            <Field
              label="Name"
              id="customer-name"
            >
              <Input
                id="customer-name"
                value={
                  name
                }
                onChange={
                  (
                    event,
                  ) =>
                    setName(
                      event.target
                        .value,
                    )
                }
                maxLength={
                  120
                }
                required
              />
            </Field>

            <Field
              label="Email"
              id="customer-email"
            >
              <Input
                id="customer-email"
                type="email"
                value={
                  email
                }
                onChange={
                  (
                    event,
                  ) =>
                    setEmail(
                      event.target
                        .value,
                    )
                }
                maxLength={
                  254
                }
              />
            </Field>

            <Field
              label="Phone"
              id="customer-phone"
            >
              <Input
                id="customer-phone"
                value={
                  phone
                }
                onChange={
                  (
                    event,
                  ) =>
                    setPhone(
                      event.target
                        .value,
                    )
                }
                maxLength={
                  40
                }
              />
            </Field>

            <Field
              label="Company"
              id="customer-company"
            >
              <Input
                id="customer-company"
                value={
                  company
                }
                onChange={
                  (
                    event,
                  ) =>
                    setCompany(
                      event.target
                        .value,
                    )
                }
                maxLength={
                  120
                }
              />
            </Field>

            <Field
              label="Notes"
              id="customer-notes"
            >
              <Textarea
                id="customer-notes"
                value={
                  notes
                }
                onChange={
                  (
                    event,
                  ) =>
                    setNotes(
                      event.target
                        .value,
                    )
                }
                maxLength={
                  2000
                }
                className="min-h-28"
              />
            </Field>

            {mutation.isError && (
              <p
                className="text-sm text-destructive"
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

              {editing
                ? 'Save changes'
                : 'Create customer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  id,
  children,
}: {
  label:
    string;

  id:
    string;

  children:
    React.ReactNode;
}) {
  return (
    <div>
      <Label
        htmlFor={
          id
        }
      >
        {label}
      </Label>

      <div
        className="mt-2"
      >
        {children}
      </div>
    </div>
  );
}
