import { QUEUE_NAMES } from '../jobs/jobs.constants.js';

export const MONITORED_QUEUES = Object.values(QUEUE_NAMES);
export type MonitoredQueue = (typeof MONITORED_QUEUES)[number];
export const HEARTBEAT_INTERVAL_MS = 15_000;
export const HEARTBEAT_TTL_MS = 75_000;
export const QUEUE_SAMPLE_INTERVAL_MS = 30_000;
export const MONITOR_TIMEOUT_MS = 2_000;
export const BACKLOG_WARNING_COUNT = 100;

export function heartbeatKey(queue: MonitoredQueue): string {
  return `opsdesk:observability:workers:${queue}`;
}

export async function bounded<T>(operation: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error('Monitoring timed out')),
          MONITOR_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
