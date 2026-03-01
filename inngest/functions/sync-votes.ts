import { inngest } from '@/lib/inngest';
import { callSyncRoute } from '@/inngest/helpers';
import { pingHeartbeat } from '@/lib/sync-utils';

export const syncVotes = inngest.createFunction(
  {
    id: 'sync-votes',
    retries: 2,
    concurrency: { limit: 1, scope: 'env', key: '"koios"' },
  },
  { cron: '15 */6 * * *' },
  async ({ step }) => {
    const result = await step.run('execute-votes-sync', () =>
      callSyncRoute('/api/sync/votes', 300_000)
    );
    await step.run('heartbeat', () => pingHeartbeat('HEARTBEAT_URL_BATCH'));
    return result;
  },
);
