'use client';

import {
  useState,
} from 'react';

import {
  Archive,
  LoaderCircle,
} from 'lucide-react';

import {
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import {
  toast,
} from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

import {
  Button,
} from '@/components/ui/button';

import {
  archiveCustomer,
} from '@/lib/api/customers.client';

export function ArchiveCustomerDialog({
  organizationId,
  customerId,
  customerName,
}: {
  organizationId:
    string;

  customerId:
    string;

  customerName:
    string;
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

  const mutation =
    useMutation({
      mutationFn:
        () =>
          archiveCustomer(
            organizationId,
            customerId,
          ),

      onSuccess:
        async () => {
          setOpen(
            false,
          );

          await Promise.all([
            queryClient
              .invalidateQueries({
                queryKey: [
                  'customer',
                  organizationId,
                  customerId,
                ],
              }),

            queryClient
              .invalidateQueries({
                queryKey: [
                  'customers',
                  organizationId,
                ],
              }),
          ]);

          toast.success(
            'Customer archived',
          );
        },

      onError:
        (
          error,
        ) => {
          toast.error(
            error.message,
          );
        },
    });

  return (
    <AlertDialog
      open={
        open
      }
      onOpenChange={
        (nextOpen) => {
          if (
            !mutation.isPending
          ) {
            setOpen(
              nextOpen,
            );
          }
        }
      }
    >
      <AlertDialogTrigger
        render={
          <Button
            variant="outline"
            disabled={
              mutation.isPending
            }
          />
        }
      >
        {mutation.isPending ? (
          <LoaderCircle
            className="size-4 animate-spin"
          />
        ) : (
          <Archive
            className="size-4"
          />
        )}

        Archive
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Archive customer?
          </AlertDialogTitle>

          <AlertDialogDescription>
            {customerName} will remain
            in OpsDesk, but archived
            customers cannot be edited
            until restored.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={
              mutation.isPending
            }
          >
            Cancel
          </AlertDialogCancel>

          <AlertDialogAction
            disabled={
              mutation.isPending
            }
            onClick={
              () =>
                mutation.mutate()
            }
          >
            {mutation.isPending && (
              <LoaderCircle
                className="size-4 animate-spin"
              />
            )}

            {mutation.isPending
              ? 'Archiving…'
              : 'Archive customer'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
