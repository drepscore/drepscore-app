import { inngest } from '@/lib/inngest';
import { executeVotesSync } from '@/lib/sync/votes';
import { pingHeartbeat } from '@/lib/sync-utils';
import { cronCheckIn, cronCheckOut } from '@/lib/sentry-cron';

export const syncVotes = inngest.createFunction(
  {
    id: 'sync-votes',
    retries: 2,
    concurrency: { limit: 2, scope: 'env', key: '"koios-batch"' },
  },
  [{ cron: '15 */6 * * *' }, { event: 'drepscore/sync.votes' }],
  async ({ step }) => {
    const checkInId = cronCheckIn('sync-votes', '15 */6 * * *');
    try {
      const result = await step.run('execute-votes-sync', () => executeVotesSync());
      await step.run('heartbeat', () => pingHeartbeat('HEARTBEAT_URL_BATCH'));
      cronCheckOut('sync-votes', checkInId, true);
      return result;
    } catch (error) {
      cronCheckOut('sync-votes', checkInId, false);
      throw error;
    }
  },
);
