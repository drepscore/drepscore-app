import { inngest } from '@/lib/inngest';
import { callSyncRoute } from '@/inngest/helpers';
import { pingHeartbeat } from '@/lib/sync-utils';

export const syncDreps = inngest.createFunction(
  {
    id: 'sync-dreps',
    retries: 2,
    concurrency: { limit: 1, scope: 'env', key: '"koios"' },
  },
  { cron: '0 */6 * * *' },
  async ({ step }) => {
    const result = await step.run('execute-dreps-sync', () =>
      callSyncRoute('/api/sync/dreps', 300_000)
    );
    await step.run('heartbeat', () => pingHeartbeat('HEARTBEAT_URL_BATCH'));
    return result;
  },
);
