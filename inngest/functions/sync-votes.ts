import { inngest } from '@/lib/inngest';
import { callSyncRoute } from '@/inngest/helpers';

export const syncVotes = inngest.createFunction(
  {
    id: 'sync-votes',
    retries: 2,
    concurrency: { limit: 1, scope: 'env', key: '"koios"' },
  },
  { cron: '15 */6 * * *' },
  async ({ step }) => {
    return step.run('execute-votes-sync', () =>
      callSyncRoute('/api/sync/votes', 300_000)
    );
  },
);
