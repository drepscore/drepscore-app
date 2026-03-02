import { inngest } from '@/lib/inngest';
import { callSyncRoute } from '@/inngest/helpers';
import { pingHeartbeat } from '@/lib/sync-utils';

export const syncSecondary = inngest.createFunction(
  {
    id: 'sync-secondary',
    retries: 2,
    concurrency: { limit: 2, scope: 'env', key: '"koios-batch"' },
  },
  { cron: '30 */6 * * *' },
  async ({ step }) => {
    const result = await step.run('execute-secondary-sync', () =>
      callSyncRoute('/api/sync/secondary', 300_000)
    );
    await step.run('heartbeat-batch', () => pingHeartbeat('HEARTBEAT_URL_BATCH'));
    return result;
  },
);
