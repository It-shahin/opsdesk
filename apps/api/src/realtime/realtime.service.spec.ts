import {
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import type {
  RealtimeNamespace,
} from './realtime.types.js';

import {
  RealtimeService,
} from './realtime.service.js';

describe(
  'RealtimeService',
  () => {
    const ORG_A =
      '22222222-2222-4222-8222-222222222222';

    const TICKET_A =
      '55555555-5555-4555-8555-555555555555';

    const MESSAGE_A =
      '66666666-6666-4666-8666-666666666666';

    const DELIVERY_A =
      '77777777-7777-4777-8777-777777777777';

    let service:
      RealtimeService;

    const emitMock =
      jest.fn();

    const secondToMock =
      jest.fn();

    const firstToMock =
      jest.fn();

    beforeEach(
      () => {
        jest.resetAllMocks();

        service =
          new RealtimeService();

        secondToMock
          .mockReturnValue({
            emit:
              emitMock,
          });

        firstToMock
          .mockReturnValue({
            to:
              secondToMock,

            emit:
              emitMock,
          });

        service.bindNamespace(
          {
            to:
              firstToMock,
          } as unknown as
            RealtimeNamespace,
        );
      },
    );

    it(
      'publishes ticket creation to the organization room',
      () => {
        const published =
          service
            .publishTicketCreated({
              organizationId:
                ORG_A,

              ticketId:
                TICKET_A,
            });

        expect(
          published,
        ).toBe(
          true,
        );

        expect(
          firstToMock,
        ).toHaveBeenCalledWith(
          `organization:${ORG_A}`,
        );

        expect(
          secondToMock,
        ).not.toHaveBeenCalled();

        expect(
          emitMock,
        ).toHaveBeenCalledWith(
          'ticket.created',

          expect.objectContaining({
            organizationId:
              ORG_A,

            ticketId:
              TICKET_A,

            occurredAt:
              expect.any(
                String,
              ),
          }),
        );
      },
    );

    it(
      'publishes ticket updates to organization and ticket rooms',
      () => {
        const published =
          service
            .publishTicketUpdated({
              organizationId:
                ORG_A,

              ticketId:
                TICKET_A,
            });

        expect(
          published,
        ).toBe(
          true,
        );

        expect(
          firstToMock,
        ).toHaveBeenCalledWith(
          `organization:${ORG_A}`,
        );

        expect(
          secondToMock,
        ).toHaveBeenCalledWith(
          `ticket:${ORG_A}:${TICKET_A}`,
        );

        expect(
          emitMock,
        ).toHaveBeenCalledWith(
          'ticket.updated',

          expect.objectContaining({
            organizationId:
              ORG_A,

            ticketId:
              TICKET_A,

            occurredAt:
              expect.any(
                String,
              ),
          }),
        );
      },
    );

    it(
      'publishes message creation to organization and ticket rooms',
      () => {
        const published =
          service
            .publishMessageCreated({
              organizationId:
                ORG_A,

              ticketId:
                TICKET_A,

              messageId:
                MESSAGE_A,
            });

        expect(
          published,
        ).toBe(
          true,
        );

        expect(
          firstToMock,
        ).toHaveBeenCalledWith(
          `organization:${ORG_A}`,
        );

        expect(
          secondToMock,
        ).toHaveBeenCalledWith(
          `ticket:${ORG_A}:${TICKET_A}`,
        );

        expect(
          emitMock,
        ).toHaveBeenCalledWith(
          'ticket.message.created',

          expect.objectContaining({
            organizationId:
              ORG_A,

            ticketId:
              TICKET_A,

            messageId:
              MESSAGE_A,

            occurredAt:
              expect.any(
                String,
              ),
          }),
        );
      },
    );

    it(
      'publishes delivery updates only to the ticket room',
      () => {
        const published =
          service
            .publishEmailDeliveryUpdated({
              organizationId:
                ORG_A,

              ticketId:
                TICKET_A,

              messageId:
                MESSAGE_A,

              emailDeliveryId:
                DELIVERY_A,

              status:
                'DELIVERED',
            });

        expect(
          published,
        ).toBe(
          true,
        );

        expect(
          firstToMock,
        ).toHaveBeenCalledWith(
          `ticket:${ORG_A}:${TICKET_A}`,
        );

        expect(
          secondToMock,
        ).not.toHaveBeenCalled();

        expect(
          emitMock,
        ).toHaveBeenCalledWith(
          'email.delivery.updated',

          expect.objectContaining({
            organizationId:
              ORG_A,

            ticketId:
              TICKET_A,

            messageId:
              MESSAGE_A,

            emailDeliveryId:
              DELIVERY_A,

            status:
              'DELIVERED',

            occurredAt:
              expect.any(
                String,
              ),
          }),
        );
      },
    );

    it(
      'safely skips events before the namespace is initialized',
      () => {
        const unbound =
          new RealtimeService();

        expect(
          unbound
            .publishTicketCreated({
              organizationId:
                ORG_A,

              ticketId:
                TICKET_A,
            }),
        ).toBe(
          false,
        );

        expect(
          unbound
            .publishTicketUpdated({
              organizationId:
                ORG_A,

              ticketId:
                TICKET_A,
            }),
        ).toBe(
          false,
        );

        expect(
          unbound
            .publishMessageCreated({
              organizationId:
                ORG_A,

              ticketId:
                TICKET_A,

              messageId:
                MESSAGE_A,
            }),
        ).toBe(
          false,
        );

        expect(
          unbound
            .publishEmailDeliveryUpdated({
              organizationId:
                ORG_A,

              ticketId:
                TICKET_A,

              messageId:
                MESSAGE_A,

              emailDeliveryId:
                DELIVERY_A,

              status:
                'DELIVERED',
            }),
        ).toBe(
          false,
        );

        expect(
          firstToMock,
        ).not.toHaveBeenCalled();

        expect(
          secondToMock,
        ).not.toHaveBeenCalled();

        expect(
          emitMock,
        ).not.toHaveBeenCalled();
      },
    );
  },
);
