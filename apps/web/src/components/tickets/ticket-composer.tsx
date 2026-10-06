'use client';

import type {
  ChangeEvent,
  FormEvent,
} from 'react';

import {
  useRef,
  useState,
} from 'react';

import {
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import {
  File,
  LoaderCircle,
  LockKeyhole,
  Paperclip,
  Send,
  X,
} from 'lucide-react';

import {
  Button,
} from '@/components/ui/button';

import {
  Textarea,
} from '@/components/ui/textarea';

import {
  createTicketMessage,
  uploadTicketAttachment,
} from '@/lib/api/tickets.client';

import {
  ATTACHMENT_ACCEPT,
  validateFiles,
} from '@/lib/attachments/policy';

import {
  formatFileSize,
} from '@/lib/tickets/format';

import type {
  TicketMessage,
  TicketStatus,
} from '@/lib/tickets/types';

type MessageKind =
  | 'PUBLIC_REPLY'
  | 'INTERNAL_NOTE';

export function TicketComposer({
  organizationId,
  ticketId,
  ticketStatus,
  customerEmail,
  canWrite,
}: {
  organizationId:
    string;

  ticketId:
    string;

  ticketStatus:
    TicketStatus;

  customerEmail:
    string | null;

  canWrite:
    boolean;
}) {
  const queryClient =
    useQueryClient();

  const fileInput =
    useRef<HTMLInputElement>(
      null,
    );

  const [
    selectedKind,
    setKind,
  ] =
    useState<MessageKind>(
      ticketStatus ===
        'CLOSED'
        ? 'INTERNAL_NOTE'
        : 'PUBLIC_REPLY',
    );

  const kind =
    ticketStatus ===
      'CLOSED'
      ? 'INTERNAL_NOTE'
      : selectedKind;

  const [
    body,
    setBody,
  ] =
    useState(
      '',
    );

  const [
    files,
    setFiles,
  ] =
    useState<File[]>(
      [],
    );

  const [
    localError,
    setLocalError,
  ] =
    useState<
      string |
      null
    >(
      null,
    );

  const [
    uploadIndex,
    setUploadIndex,
  ] =
    useState<
      number |
      null
    >(
      null,
    );

  const mutation =
    useMutation({
      mutationFn:
        async () => {
          const trimmed =
            body.trim();

          if (
            !trimmed
          ) {
            throw new Error(
              'Message cannot be empty.',
            );
          }

          const validation =
            validateFiles(
              files,
            );

          if (
            validation
          ) {
            throw new Error(
              validation,
            );
          }

          const attachmentIds:
            string[] =
            [];

          for (
            let index =
              0;
            index <
            files.length;
            index +=
              1
          ) {
            setUploadIndex(
              index +
                1,
            );

            const attachment =
              await uploadTicketAttachment(
                organizationId,
                ticketId,
                files[index],
              );

            attachmentIds.push(
              attachment.id,
            );
          }

          return createTicketMessage(
            organizationId,
            ticketId,
            {
              kind,
              body:
                trimmed,

              attachmentIds:
                attachmentIds.length
                  ? attachmentIds
                  : undefined,
            },
          );
        },

      onSuccess:
        (
          message,
        ) => {
          queryClient
            .setQueryData<
              TicketMessage[]
            >(
              [
                'ticket-messages',
                organizationId,
                ticketId,
              ],

              (
                current,
              ) => {
                if (
                  !current
                ) {
                  return [
                    message,
                  ];
                }

                if (
                  current.some(
                    (
                      item,
                    ) =>
                      item.id ===
                      message.id,
                  )
                ) {
                  return current;
                }

                return [
                  ...current,
                  message,
                ];
              },
            );

          /*
           * 9I will make this happen
           * from realtime events too.
           */
          void queryClient
            .invalidateQueries({
              queryKey: [
                'tickets',
                organizationId,
              ],
            });

          setBody(
            '',
          );

          setFiles(
            [],
          );

          setLocalError(
            null,
          );

          if (
            fileInput.current
          ) {
            fileInput.current
              .value =
              '';
          }
        },

      onSettled:
        () => {
          setUploadIndex(
            null,
          );
        },
    });

  if (
    !canWrite
  ) {
    return (
      <div
        className="rounded-lg border border-dashed bg-background p-4 text-center text-sm text-muted-foreground"
      >
        You have read-only access to
        this workspace.
      </div>
    );
  }

  function selectFiles(
    event:
      ChangeEvent<HTMLInputElement>,
  ) {
    const selected =
      Array.from(
        event.target
          .files ??
          [],
      );

    const next =
      [
        ...files,
        ...selected,
      ];

    const validation =
      validateFiles(
        next,
      );

    if (
      validation
    ) {
      setLocalError(
        validation,
      );

      event.target.value =
        '';

      return;
    }

    setFiles(
      next,
    );

    setLocalError(
      null,
    );

    event.target.value =
      '';
  }

  function removeFile(
    index:
      number,
  ) {
    setFiles(
      (
        current,
      ) =>
        current.filter(
          (
            _,
            currentIndex,
          ) =>
            currentIndex !==
            index,
        ),
    );
  }

  function submit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setLocalError(
      null,
    );

    mutation.mutate();
  }

  const pending =
    mutation.isPending;

  return (
    <form
      onSubmit={
        submit
      }
      className="rounded-lg border bg-background"
    >
      <div
        className="flex items-center gap-1 border-b p-2"
      >
        <Button
          type="button"
          size="sm"
          variant={
            kind ===
              'PUBLIC_REPLY'
              ? 'secondary'
              : 'ghost'
          }
          disabled={
            pending ||
            ticketStatus ===
              'CLOSED'
          }
          onClick={
            () =>
              setKind(
                'PUBLIC_REPLY',
              )
          }
        >
          <Send
            className="size-4"
          />

          Reply
        </Button>

        <Button
          type="button"
          size="sm"
          variant={
            kind ===
              'INTERNAL_NOTE'
              ? 'secondary'
              : 'ghost'
          }
          disabled={
            pending
          }
          onClick={
            () =>
              setKind(
                'INTERNAL_NOTE',
              )
          }
        >
          <LockKeyhole
            className="size-4"
          />

          Internal note
        </Button>
      </div>

      {ticketStatus ===
        'CLOSED' && (
        <div
          className="border-b bg-muted/30 px-4 py-2 text-xs text-muted-foreground"
        >
          This ticket is closed.
          Public replies require the
          ticket to be reopened first.
        </div>
      )}

      {kind ===
        'PUBLIC_REPLY' &&
        !customerEmail && (
        <div
          className="border-b bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-200"
        >
          This customer has no email
          address. The reply will be
          recorded, but email delivery
          will fail.
        </div>
      )}

      <Textarea
        value={
          body
        }
        onChange={
          (
            event,
          ) =>
            setBody(
              event.target
                .value,
            )
        }
        maxLength={
          20_000
        }
        disabled={
          pending
        }
        placeholder={
          kind ===
            'PUBLIC_REPLY'
            ? 'Write a reply to the customer…'
            : 'Write an internal note for your team…'
        }
        className="min-h-32 resize-y border-0 shadow-none focus-visible:ring-0"
      />

      {files.length >
        0 && (
        <div
          className="space-y-2 border-t p-3"
        >
          {files.map(
            (
              file,
              index,
            ) => (
              <div
                key={`${file.name}-${file.size}-${index}`}
                className="flex items-center gap-3 rounded-md bg-muted/40 px-3 py-2"
              >
                <File
                  className="size-4 shrink-0"
                />

                <div
                  className="min-w-0 flex-1"
                >
                  <p
                    className="truncate text-sm"
                  >
                    {file.name}
                  </p>

                  <p
                    className="text-xs text-muted-foreground"
                  >
                    {formatFileSize(
                      file.size,
                    )}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={
                    pending
                  }
                  onClick={
                    () =>
                      removeFile(
                        index,
                      )
                  }
                  aria-label={`Remove ${file.name}`}
                >
                  <X
                    className="size-4"
                  />
                </Button>
              </div>
            ),
          )}
        </div>
      )}

      {(localError ||
        mutation.isError) && (
        <p
          className="border-t px-4 py-2 text-sm text-destructive"
        >
          {localError ??
            mutation.error
              ?.message}
        </p>
      )}

      <div
        className="flex items-center justify-between border-t p-3"
      >
        <div>
          <input
            ref={
              fileInput
            }
            type="file"
            multiple
            accept={
              ATTACHMENT_ACCEPT
            }
            className="hidden"
            onChange={
              selectFiles
            }
          />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={
              pending
            }
            onClick={
              () =>
                fileInput.current
                  ?.click()
            }
          >
            <Paperclip
              className="size-4"
            />

            Attach
          </Button>
        </div>

        <Button
          type="submit"
          disabled={
            pending ||
            !body.trim()
          }
        >
          {pending ? (
            <>
              <LoaderCircle
                className="size-4 animate-spin"
              />

              {uploadIndex
                ? `Uploading ${uploadIndex} of ${files.length}`
                : 'Sending…'}
            </>
          ) : kind ===
            'PUBLIC_REPLY' ? (
            <>
              <Send
                className="size-4"
              />

              Send reply
            </>
          ) : (
            <>
              <LockKeyhole
                className="size-4"
              />

              Add note
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
