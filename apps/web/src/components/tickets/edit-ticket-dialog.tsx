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
} from 'lucide-react';

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
  updateTicket,
} from '@/lib/api/tickets.client';

import type {
  TicketDetail,
} from '@/lib/api/tickets.server';

import {
  invalidateTicketData,
} from '@/lib/tickets/invalidate';

export function EditTicketDialog({
  organizationId,
  ticket,
}: {
  organizationId:
    string;

  ticket:
    TicketDetail;
}) {
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
    subject,
    setSubject,
  ] =
    useState(
      ticket.subject,
    );

  const [
    description,
    setDescription,
  ] =
    useState(
      ticket.description ??
        '',
    );

  const mutation =
    useMutation({
      mutationFn:
        () =>
          updateTicket(
            organizationId,
            ticket.id,
            {
              subject:
                subject.trim(),

              description:
                description
                  .trim() ||
                null,
            },
          ),

      onSuccess:
        async () => {
          await invalidateTicketData(
            queryClient,
            organizationId,
            ticket.id,
          );

          setOpen(
            false,
          );

          toast.success(
            'Ticket updated',
          );
        },

      onError:
        (error) => {
          toast.error(
            error.message,
          );
        },
    });

  function changeOpen(
    next:
      boolean,
  ) {
    if (
      next
  ) {
      setSubject(
        ticket.subject,
      );

      setDescription(
        ticket.description ??
          '',
      );
    }

    setOpen(
      next,
    );
  }

  function submit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !subject.trim()
    ) {
      return;
    }

    mutation.mutate();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={
        changeOpen
      }
    >
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
          />
        }
      >
        <Pencil
          className="size-4"
        />

        Edit
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
              Edit ticket
            </DialogTitle>

            <DialogDescription>
              Update the subject or
              original ticket
              description.
            </DialogDescription>
          </DialogHeader>

          <div
            className="space-y-4 py-6"
          >
            <div>
              <Label
                htmlFor="ticket-subject"
              >
                Subject
              </Label>

              <Input
                id="ticket-subject"
                value={
                  subject
                }
                onChange={
                  (
                    event,
                  ) =>
                    setSubject(
                      event.target
                        .value,
                    )
                }
                maxLength={
                  200
                }
                className="mt-2"
                disabled={
                  mutation.isPending
                }
              />
            </div>

            <div>
              <Label
                htmlFor="ticket-description"
              >
                Description
              </Label>

              <Textarea
                id="ticket-description"
                value={
                  description
                }
                onChange={
                  (
                    event,
                  ) =>
                    setDescription(
                      event.target
                        .value,
                    )
                }
                maxLength={
                  5000
                }
                className="mt-2 min-h-32"
                disabled={
                  mutation.isPending
                }
              />
            </div>

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
                !subject.trim()
              }
            >
              {mutation.isPending && (
                <LoaderCircle
                  className="size-4 animate-spin"
                />
              )}

              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
