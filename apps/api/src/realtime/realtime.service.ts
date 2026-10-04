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
  TicketCreatedRealtimePayload,
  TicketMessageCreatedRealtimePayload,
  TicketUpdatedRealtimePayload,
} from './realtime.types.js';

import type {
  EmailDeliveryStatus,
} from '../generated/prisma/enums.js';

import type {
  Emitter,
} from '@socket.io/redis-emitter';

import {
  RealtimeRedisEmitterService,
} from './realtime-redis-emitter.service.js';

import type {
  ServerToClientEvents,
} from './realtime.types.js';

@Injectable()
export class RealtimeService {
  private readonly logger =
    new Logger(
      RealtimeService.name,
    );

  constructor(
    private readonly redisEmitter:
      RealtimeRedisEmitterService,
  ) {}

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
        emitter,
      ) => {
        emitter
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
        emitter,
      ) => {
        emitter
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
        emitter,
      ) => {
        emitter
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
        emitter,
      ) => {
        emitter
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

  private publish(
    action:
      (
        emitter:
          Emitter<
            ServerToClientEvents
          >,
      ) => void,
  ): boolean {
    try {
      action(
        this.redisEmitter
          .getEmitter(),
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
