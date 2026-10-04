import {
  Injectable,
  Logger,
} from '@nestjs/common';

import {
  REALTIME_EVENTS,
} from './realtime.constants.js';

import {
  organizationRoom,
  ticketRoom,
} from './realtime.rooms.js';

import type {
  EmailDeliveryUpdatedRealtimePayload,
  RealtimeNamespace,
  TicketCreatedRealtimePayload,
  TicketMessageCreatedRealtimePayload,
  TicketUpdatedRealtimePayload,
} from './realtime.types.js';

import type {
  EmailDeliveryStatus,
} from '../generated/prisma/enums.js';

@Injectable()
export class RealtimeService {
  private readonly logger =
    new Logger(
      RealtimeService.name,
    );

  private namespace:
    RealtimeNamespace |
    undefined;

  bindNamespace(
    namespace:
      RealtimeNamespace,
  ) {
    this.namespace =
      namespace;

    this.logger.log(
      'Realtime publisher bound to Socket.IO namespace',
    );
  }

  publishTicketCreated(
    input: {
      organizationId:
        string;

      ticketId:
        string;
    },
  ): boolean {
    const payload:
      TicketCreatedRealtimePayload =
      {
        organizationId:
          input.organizationId,

        ticketId:
          input.ticketId,

        occurredAt:
          new Date()
            .toISOString(),
      };

    return this.publish(
      (
        namespace,
      ) => {
        namespace
          .to(
            organizationRoom(
              input.organizationId,
            ),
          )
          .emit(
            REALTIME_EVENTS
              .TICKET_CREATED,
            payload,
          );
      },
    );
  }

  publishTicketUpdated(
    input: {
      organizationId:
        string;

      ticketId:
        string;
    },
  ): boolean {
    const payload:
      TicketUpdatedRealtimePayload =
      {
        organizationId:
          input.organizationId,

        ticketId:
          input.ticketId,

        occurredAt:
          new Date()
            .toISOString(),
      };

    return this.publish(
      (
        namespace,
      ) => {
        namespace
          .to(
            organizationRoom(
              input.organizationId,
            ),
          )
          .to(
            ticketRoom(
              input.organizationId,
              input.ticketId,
            ),
          )
          .emit(
            REALTIME_EVENTS
              .TICKET_UPDATED,
            payload,
          );
      },
    );
  }

  publishMessageCreated(
    input: {
      organizationId:
        string;

      ticketId:
        string;

      messageId:
        string;
    },
  ): boolean {
    const payload:
      TicketMessageCreatedRealtimePayload =
      {
        organizationId:
          input.organizationId,

        ticketId:
          input.ticketId,

        messageId:
          input.messageId,

        occurredAt:
          new Date()
            .toISOString(),
      };

    return this.publish(
      (
        namespace,
      ) => {
        namespace
          .to(
            organizationRoom(
              input.organizationId,
            ),
          )
          .to(
            ticketRoom(
              input.organizationId,
              input.ticketId,
            ),
          )
          .emit(
            REALTIME_EVENTS
              .TICKET_MESSAGE_CREATED,
            payload,
          );
      },
    );
  }

  publishEmailDeliveryUpdated(
    input: {
      organizationId:
        string;

      ticketId:
        string;

      messageId:
        string;

      emailDeliveryId:
        string;

      status:
        EmailDeliveryStatus;
    },
  ): boolean {
    const payload:
      EmailDeliveryUpdatedRealtimePayload =
      {
        organizationId:
          input.organizationId,

        ticketId:
          input.ticketId,

        messageId:
          input.messageId,

        emailDeliveryId:
          input.emailDeliveryId,

        status:
          input.status,

        occurredAt:
          new Date()
            .toISOString(),
      };

    return this.publish(
      (
        namespace,
      ) => {
        namespace
          .to(
            ticketRoom(
              input.organizationId,
              input.ticketId,
            ),
          )
          .emit(
            REALTIME_EVENTS
              .EMAIL_DELIVERY_UPDATED,
            payload,
          );
      },
    );
  }

  private getNamespace():
    RealtimeNamespace |
    null {
    if (!this.namespace) {
      /*
       * Realtime delivery is ephemeral.
       * Failure to publish must never
       * corrupt the primary database
       * operation.
       */
      this.logger.warn(
        'Realtime namespace is not initialized; event skipped',
      );

      return null;
    }

    return this.namespace;
  }
  private publish(
  action:
    (
      namespace:
        RealtimeNamespace,
    ) => void,
): boolean {
  const namespace =
    this.getNamespace();

  if (!namespace) {
    return false;
  }

  try {
    action(
      namespace,
    );

    return true;
  } catch (error) {
    this.logger.error(
      'Failed to publish realtime event',
      error instanceof Error
        ? error.stack
        : undefined,
    );

    return false;
  }
}
}
