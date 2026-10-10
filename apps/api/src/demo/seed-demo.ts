import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { assertSafeDemoTarget, parseDemoOptions } from './demo-options.js';
import { runDemo } from './demo-seed.js';

// Standalone entrypoint, deliberately never imported by AppModule/WorkerModule.
async function main() {
  const options = parseDemoOptions(process.argv.slice(2));
  const connectionString = assertSafeDemoTarget(options, process.env);
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 5000 }),
  });
  try {
    console.log(
      JSON.stringify(await runDemo(prisma, options, process.env), null, 2),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  // Never print Prisma/pg errors verbatim: they can contain connection details.
  const message =
    error instanceof Error && !('code' in error) && !('clientVersion' in error)
      ? error.message
      : 'Database operation failed and was rolled back. Check connectivity, schema and ID conflicts; retry serializable conflicts manually.';
  console.error(`Demo command failed: ${message}`);
  process.exitCode = 1;
});
