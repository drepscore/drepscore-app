import { inngest } from '@/lib/inngest';
import { callSyncRoute } from '@/inngest/helpers';

export const syncSecondary = inngest.createFunction(
  {
    id: 'sync-secondary',
    retries: 2,
    concurrency: { limit: 1, scope: 'env', key: '"koios"' },
  },
  { cron: '30 */6 * * *' },
  async ({ step }) => {
    return step.run('execute-secondary-sync', () =>
      callSyncRoute('/api/sync/secondary', 300_000)
    );
  },
);
