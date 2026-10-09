import { describe, expect, it } from '@jest/globals';
import { EmailWorker } from '../jobs/email.worker.js';
import { MaintenanceWorker } from '../jobs/maintenance.worker.js';

for (const consumerClass of [EmailWorker, MaintenanceWorker]) {
  describe(`${consumerClass.name} heartbeat eligibility`, () => {
    it.each([
      ['ready', true, false, true],
      ['ready', false, false, false],
      ['ready', true, true, false],
      ['reconnecting', true, false, false],
      ['end', true, false, false],
    ] as const)(
      'reports Redis=%s running=%s paused=%s as healthy=%s',
      (status, running, paused, expected) => {
        const consumer = Object.assign(Object.create(consumerClass.prototype), {
          connection: { status },
          worker: { isRunning: () => running, isPaused: () => paused },
        }) as EmailWorker | MaintenanceWorker;
        expect(consumer.isHealthy()).toBe(expected);
      },
    );

    it('does not advertise an uninitialized worker', () => {
      const consumer = Object.assign(Object.create(consumerClass.prototype), {
        connection: { status: 'ready' },
        worker: null,
      }) as EmailWorker | MaintenanceWorker;
      expect(consumer.isHealthy()).toBe(false);
    });
  });
}
