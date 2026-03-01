import { inngest } from '@/lib/inngest';
import { callSyncRoute } from '@/inngest/helpers';
import { pingHeartbeat } from '@/lib/sync-utils';

export const syncSlow = inngest.createFunction(
  {
    id: 'sync-slow',
    retries: 1,
    concurrency: { limit: 1, scope: 'env', key: '"slow-sync"' },
  },
  { cron: '0 4 * * *' },
  async ({ step }) => {
    const result = await step.run('execute-slow-sync', () =>
      callSyncRoute('/api/sync/slow', 300_000)
    );
    await step.run('heartbeat', () => pingHeartbeat('HEARTBEAT_URL_DAILY'));
    return result;
  },
);
