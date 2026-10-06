'use client';

import {
  Download,
  File,
  LoaderCircle,
} from 'lucide-react';

import {
  useState,
} from 'react';

import {
  Button,
} from '@/components/ui/button';

import {
  getAttachmentDownload,
} from '@/lib/api/tickets.client';

import {
  formatFileSize,
} from '@/lib/tickets/format';

import type {
  TicketAttachment as TicketAttachmentType,
} from '@/lib/tickets/types';

export function TicketAttachment({
  organizationId,
  ticketId,
  attachment,
}: {
  organizationId:
    string;

  ticketId:
    string;

  attachment:
    TicketAttachmentType;
}) {
  const [
    downloading,
    setDownloading,
  ] =
    useState(
      false,
    );

  async function download() {
    setDownloading(
      true,
    );

    try {
      const result =
        await getAttachmentDownload(
          organizationId,
          ticketId,
          attachment.id,
        );

      window.open(
        result.download.url,
        '_blank',
        'noopener,noreferrer',
      );
    } finally {
      setDownloading(
        false,
      );
    }
  }

  return (
    <div
      className="flex items-center gap-3 rounded-lg border bg-background p-3"
    >
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted"
      >
        <File
          className="size-4"
        />
      </div>

      <div
        className="min-w-0 flex-1"
      >
        <p
          className="truncate text-sm font-medium"
        >
          {attachment.originalName}
        </p>

        <p
          className="text-xs text-muted-foreground"
        >
          {formatFileSize(
            attachment.sizeBytes,
          )}
        </p>
      </div>

      <Button
        variant="ghost"
        size="icon"
        disabled={
          downloading
        }
        onClick={
          () =>
            void download()
        }
        aria-label={`Download ${attachment.originalName}`}
      >
        {downloading ? (
          <LoaderCircle
            className="size-4 animate-spin"
          />
        ) : (
          <Download
            className="size-4"
          />
        )}
      </Button>
    </div>
  );
}