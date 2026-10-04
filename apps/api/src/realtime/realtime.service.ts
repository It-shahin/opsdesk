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
    const namespace =
      this.getNamespace();

    if (!namespace) {
      return false;
    }

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

    return true;
  }

  publishTicketUpdated(
    input: {
      organizationId:
        string;

      ticketId:
        string;
    },
  ): boolean {
    const namespace =
      this.getNamespace();

    if (!namespace) {
      return false;
    }

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

    return true;
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
    const namespace =
      this.getNamespace();

    if (!namespace) {
      return false;
    }

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

    return true;
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
    const namespace =
      this.getNamespace();

    if (!namespace) {
      return false;
    }

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

    return true;
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
}