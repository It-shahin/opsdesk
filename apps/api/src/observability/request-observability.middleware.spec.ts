import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import type { Response } from 'express';
import {
  RequestObservabilityMiddleware,
  type RequestWithId,
} from './request-observability.middleware.js';

describe('HTTP logging privacy', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([200, 403, 500, 'aborted'] as const)(
    'omits sensitive request values from %s logs',
    (status) => {
      const log = jest
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => {});
      const warn = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => {});
      const error = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => {});
      const req = {
        method: 'POST',
        path: '/v1/tickets',
        route: { path: '/v1/tickets' },
        url: '/v1/tickets?search=PRIVATE_CUSTOMER_EMAIL',
        originalUrl: '/v1/tickets?search=PRIVATE_CUSTOMER_EMAIL',
        headers: {
          authorization: 'Bearer SUPER_SECRET_TOKEN',
          cookie: 'SECRET_COOKIE',
        },
        query: { search: 'PRIVATE_CUSTOMER_EMAIL' },
        body: { body: 'PRIVATE_MESSAGE' },
        header: () => undefined,
      } as unknown as RequestWithId;
      const response = Object.assign(new EventEmitter(), {
        statusCode: status === 'aborted' ? 200 : status,
        setHeader: jest.fn<(name: string, value: string) => void>(),
      });
      const next = jest.fn();
      new RequestObservabilityMiddleware().use(
        req,
        response as unknown as Response,
        next,
      );
      expect(next).toHaveBeenCalledTimes(1);
      response.emit(status === 'aborted' ? 'close' : 'finish');
      if (status !== 'aborted') response.emit('close');
      const entries = [
        ...log.mock.calls,
        ...warn.mock.calls,
        ...error.mock.calls,
      ];
      expect(entries).toHaveLength(1);
      const serializedLogs = JSON.stringify(entries);
      for (const marker of [
        'SUPER_SECRET_TOKEN',
        'SECRET_COOKIE',
        'PRIVATE_CUSTOMER_EMAIL',
        'PRIVATE_MESSAGE',
      ]) {
        expect(serializedLogs).not.toContain(marker);
      }
      expect(JSON.parse(String(entries[0]![0]))).toMatchObject({
        event: status === 'aborted' ? 'http.aborted' : 'http.request',
        requestId: req.requestId,
        method: 'POST',
        path: '/v1/tickets',
      });
    },
  );

  it.each([200, 404, 'aborted'] as const)(
    'redacts customer IDs, encoded tokens and unmatched paths from %s logs',
    (status) => {
      const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
      const req = {
        method: 'GET',
        path: '/v1/organizations/PRIVATE_ORG/customers/private%40example.test',
        route: status === 404 ? undefined : {
          path: '/v1/organizations/:organizationId/customers/:customerId',
        },
        header: () => undefined,
      } as unknown as RequestWithId;
      const response = Object.assign(new EventEmitter(), {
        statusCode: status === 'aborted' ? 200 : status,
        setHeader: jest.fn(),
      });
      new RequestObservabilityMiddleware().use(req, response as unknown as Response, () => {});
      response.emit(status === 'aborted' ? 'close' : 'finish');
      const entries = [...log.mock.calls, ...warn.mock.calls];
      expect(entries).toHaveLength(1);
      const serialized = String(entries[0]![0]);
      expect(serialized).not.toContain('PRIVATE_ORG');
      expect(serialized).not.toContain('private%40example.test');
      expect(JSON.parse(serialized).path).toBe(status === 404 ? '/[unmatched]' :
        '/v1/organizations/:organizationId/customers/:customerId');
    },
  );
});
