import { applyDecorators, RequestMethod } from '@nestjs/common';
import {
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants.js';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { IS_PUBLIC_KEY } from '../auth/public.decorator.js';
import { REQUIRED_PERMISSIONS_KEY } from '../rbac/require-permissions.decorator.js';
import {
  responseSchemas,
  type ResponseSchemaName,
} from './response-schemas.js';

export function ApiResult(
  name: ResponseSchemaName,
  description?: string,
): MethodDecorator {
  return (target, key, descriptor) => {
    const handler = descriptor.value!;
    const method = Reflect.getMetadata(
      METHOD_METADATA,
      handler,
    ) as RequestMethod;
    const status = Reflect.getMetadata(HTTP_CODE_METADATA, handler) as
      number | undefined;
    ApiResponse({
      status: status ?? (method === RequestMethod.POST ? 201 : 200),
      description: description ?? 'Successful response',
      schema: { $ref: `#/components/schemas/${name}` },
    })(target, key, descriptor);
  };
}

// Applied above @Controller so existing route, permission and public metadata
// is available. These annotations only describe behavior; they enforce nothing.
export function ApiResource(tag: string): ClassDecorator {
  return (target) => {
    ApiTags(tag)(target);
    const basePath = Reflect.getMetadata(PATH_METADATA, target) as string;
    for (const key of Object.getOwnPropertyNames(target.prototype)) {
      const descriptor = Object.getOwnPropertyDescriptor(
        target.prototype,
        key,
      )!;
      const handler = descriptor.value;
      if (
        typeof handler !== 'function' ||
        !Reflect.hasMetadata(METHOD_METADATA, handler)
      )
        continue;
      const path = `${basePath}/${Reflect.getMetadata(PATH_METADATA, handler) as string}`;
      const isPublic =
        Reflect.getMetadata(IS_PUBLIC_KEY, handler) === true ||
        Reflect.getMetadata(IS_PUBLIC_KEY, target) === true;
      const permissions = (Reflect.getMetadata(
        REQUIRED_PERMISSIONS_KEY,
        handler,
      ) ??
        Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, target) ??
        []) as string[];
      const tenant = path.includes(':organizationId');
      const method = Reflect.getMetadata(
        METHOD_METADATA,
        handler,
      ) as RequestMethod;
      const errorSchema = { $ref: '#/components/schemas/Error' };
      const details = [
        isPublic
          ? tag === 'Webhooks'
            ? 'No Auth0 bearer required. Verified Resend/Svix signature over the unmodified raw body is mandatory.'
            : 'Public health endpoint.'
          : 'Requires a verified Auth0 access token for the configured API audience.',
        tenant
          ? 'Organization membership is resolved server-side. A missing membership or foreign resource returns 404; IDs never grant access.'
          : '',
        permissions.length
          ? `Required permissions: ${permissions.join(', ')}. See docs/security.md for the role matrix and service-level restrictions.`
          : '',
        'DTO validation and documented schemas do not replace authentication or business rules.',
      ]
        .filter(Boolean)
        .join(' ');
      const decorators: MethodDecorator[] = [
        ApiOperation({
          summary: `${tag}: ${key.replace(/([A-Z])/g, ' $1').toLowerCase()}`,
          description: details,
        }),
      ];
      if (!isPublic)
        decorators.push(
          ApiBearerAuth('auth0'),
          ApiResponse({
            status: 401,
            description:
              'Missing, invalid, expired or wrong-audience access token.',
            schema: errorSchema,
          }),
        );
      if (tag === 'Health' && key !== 'getRoot' && key !== 'live')
        decorators.push(
          ApiResponse({
            status: 503,
            description:
              'Database or Redis unavailable; dependency status is included.',
            schema: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['not_ready'] },
                services: responseSchemas.Ready.properties!.services,
              },
              required: ['status', 'services'],
            },
          }),
        );
      if (tenant)
        decorators.push(
          ApiResponse({
            status: 404,
            description:
              'Organization membership or tenant-scoped resource not found.',
            schema: errorSchema,
          }),
          ApiResponse({
            status: 403,
            description:
              'Authenticated member lacks permission or violates a role restriction.',
            schema: errorSchema,
          }),
        );
      if (tag !== 'Health')
        decorators.push(
          ApiResponse({
            status: 400,
            description:
              'Malformed identifiers, DTO validation failure or invalid workflow.',
            schema: errorSchema,
          }),
          ApiResponse({
            status: 429,
            description: 'Rate limit exceeded.',
            schema: errorSchema,
          }),
        );
      if (
        tag !== 'Health' &&
        [
          RequestMethod.POST,
          RequestMethod.PATCH,
          RequestMethod.DELETE,
        ].includes(method)
      )
        decorators.push(
          ApiResponse({
            status: 409,
            description:
              'Conflict with existing data or workflow state where applicable.',
            schema: errorSchema,
          }),
        );
      for (const match of path.matchAll(/:([A-Za-z]+Id)/g))
        decorators.push(
          ApiParam({
            name: match[1],
            type: String,
            format: 'uuid',
            required: true,
            description: tenant
              ? 'Tenant-scoped UUID. Ownership and membership are checked server-side.'
              : 'Resource UUID.',
          }),
        );
      if (tag === 'Webhooks') {
        decorators.push(
          ApiSecurity('svix'),
          ...['svix-id', 'svix-timestamp', 'svix-signature'].map((name) =>
            ApiHeader({
              name,
              required: true,
              description:
                'Resend webhook signature metadata. The signature covers the exact raw request body.',
            }),
          ),
        );
      }
      applyDecorators(...decorators)(target.prototype, key, descriptor);
    }
  };
}

export { responseSchemas };
