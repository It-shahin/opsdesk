import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { NestFactory } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import SwaggerParser from '@apidevtools/swagger-parser';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { responseSchemas } from '../dist/openapi/api-documentation.js';
import { assertLocalDocsEnvironment } from './openapi-policy.mjs';

// Discover source controllers so a new controller cannot silently escape CI.
const files = (
  await readdir(new URL('../src/', import.meta.url), { recursive: true })
)
  .filter((file) => file.endsWith('.controller.ts'))
  .map((file) => file.replaceAll('\\', '/').replace(/\.ts$/, ''))
  .sort();
const output = fileURLToPath(
  new URL('../../../docs/api/openapi.json', import.meta.url),
);

export async function generateDocument() {
  // Deliberately never import AppModule or WorkerModule. Importing classes does
  // not instantiate them: no Prisma, Redis, jobs, Auth0, R2 or Resend connections.
  const controllers = (
    await Promise.all(files.map((file) => import(`../dist/${file}.js`)))
  ).flatMap((module) =>
    Object.values(module).filter((value) => typeof value === 'function'),
  );
  const tokens = new Set(
    controllers.flatMap(
      (controller) =>
        Reflect.getMetadata('design:paramtypes', controller) ?? [],
    ),
  );
  const builder = Test.createTestingModule({
    controllers,
    providers: [...tokens].map((provide) => ({
      provide,
      useValue: Object.freeze({}),
    })),
  });
  for (const controller of controllers) {
    const guards = [
      ...(Reflect.getMetadata(GUARDS_METADATA, controller) ?? []),
    ];
    for (const key of Object.getOwnPropertyNames(controller.prototype)) {
      const method = controller.prototype[key];
      if (typeof method === 'function')
        guards.push(...(Reflect.getMetadata(GUARDS_METADATA, method) ?? []));
    }
    for (const guard of guards)
      builder.overrideGuard(guard).useValue({ canActivate: () => false });
  }
  const module = await builder.compile();
  const app = module.createNestApplication();
  try {
    const config = new DocumentBuilder()
      .setTitle('OpsDesk API')
      .setDescription(
        'Tenant-scoped support operations API. Use the Next.js BFF for browser requests; Auth0 bearer tokens belong on the API boundary. See docs/api/README.md for workflows and Socket.IO events. No real credentials or account details are embedded.',
      )
      .setVersion('1.0.0')
      .addServer(
        'http://127.0.0.1:3001',
        'Local API only; configure deployment URLs privately',
      )
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description:
            'Auth0 access token with the configured API audience and issuer; never an ID token.',
        },
        'auth0',
      )
      .addSecurity('svix', {
        type: 'apiKey',
        in: 'header',
        name: 'svix-signature',
        description:
          'Verified Resend/Svix signature. Also requires svix-id and svix-timestamp; the signature covers the exact raw body.',
      })
      .build();
    const document = SwaggerModule.createDocument(app, config, {
      autoTagControllers: false,
    });
    document.components.schemas = {
      ...document.components.schemas,
      ...responseSchemas,
    };
    // Query schemas derive defaults from DTOs. Request DTO objects are strict,
    // matching whitelist + forbidNonWhitelisted on the deployed API.
    for (const [name, schema] of Object.entries(document.components.schemas)) {
      if (name.endsWith('Dto') && 'properties' in schema)
        schema.additionalProperties = false;
    }
    return document;
  } finally {
    await app.close();
  }
}

export async function validateDocument(document) {
  await SwaggerParser.validate(structuredClone(document), {
    resolve: { external: false },
  });
  const ids = new Set();
  let operations = 0;
  for (const [path, item] of Object.entries(document.paths)) {
    for (const [method, operation] of Object.entries(item)) {
      if (
        !['get', 'post', 'patch', 'delete', 'put', 'head', 'options'].includes(
          method,
        )
      )
        continue;
      operations++;
      if (!operation.operationId || ids.has(operation.operationId))
        throw new Error('Missing or duplicate operationId');
      ids.add(operation.operationId);
      if (
        !operation.tags?.length ||
        !operation.description ||
        !Object.values(operation.responses).some(
          (response) => response.content?.['application/json']?.schema,
        )
      )
        throw new Error(`Incomplete operation: ${method} ${path}`);
      if (
        path.startsWith('/v1/') &&
        path !== '/v1/webhooks/resend' &&
        !operation.security?.some((s) => 'auth0' in s)
      )
        throw new Error(`Missing bearer boundary: ${path}`);
      if (path.includes('{organizationId}') && !operation.responses['404'])
        throw new Error(`Missing tenant denial: ${path}`);
      for (const match of path.matchAll(/\{([^}]+)\}/g))
        if (
          !operation.parameters?.some(
            (p) =>
              p.in === 'path' &&
              p.name === match[1] &&
              p.required &&
              p.schema?.format === 'uuid',
          )
        )
          throw new Error(`Missing UUID path parameter ${path}`);
    }
  }
  if (operations !== 38)
    throw new Error(
      `Expected 38 documented operations, got ${operations}. Review the inventory when routes change.`,
    );
  return operations;
}

const action = process.argv[2] ?? 'generate';
if (!['generate', 'check', 'serve'].includes(action))
  throw new Error('Use generate, check or serve');
if (action === 'serve') assertLocalDocsEnvironment(process.env);
const document = await generateDocument();
const operations = await validateDocument(document);
const serialized = `${JSON.stringify(document, null, 2)}\n`;
if (action === 'check') {
  if ((await readFile(output, 'utf8')).replaceAll('\r\n', '\n') !== serialized)
    throw new Error(
      'OpenAPI snapshot is stale. Run openapi:generate and commit docs/api/openapi.json.',
    );
} else if (action === 'generate') {
  await mkdir(resolve(output, '..'), { recursive: true });
  await writeFile(output, serialized);
} else {
  class LocalDocsModule {}
  Module({})(LocalDocsModule);
  const docs = await NestFactory.create(LocalDocsModule, { logger: false });
  SwaggerModule.setup('docs', docs, document, {
    swaggerOptions: { persistAuthorization: false, supportedSubmitMethods: [] },
    raw: ['json'],
    jsonDocumentUrl: 'docs/openapi.json',
  });
  await docs.listen(3100, '127.0.0.1');
  console.log(
    'Local documentation: http://127.0.0.1:3100/docs (Try it out disabled)',
  );
}
console.log(`OpenAPI ${action}: ${operations} operations validated`);
