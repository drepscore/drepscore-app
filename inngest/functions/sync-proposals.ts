import { inngest } from '@/lib/inngest';
import { executeProposalsSync } from '@/lib/sync/proposals';
import { pingHeartbeat } from '@/lib/sync-utils';
import { cronCheckIn, cronCheckOut } from '@/lib/sentry-cron';

export const syncProposals = inngest.createFunction(
  {
    id: 'sync-proposals',
    retries: 3,
    concurrency: {
      limit: 2,
      scope: 'env',
      key: '"koios-frequent"',
    },
  },
  [{ cron: '*/30 * * * *' }, { event: 'drepscore/sync.proposals' }],
  async ({ step }) => {
    const checkInId = cronCheckIn('sync-proposals', '*/30 * * * *');
    try {
      const result = await step.run('execute-proposals-sync', () => executeProposalsSync());
      await step.run('heartbeat', () => pingHeartbeat('HEARTBEAT_URL_PROPOSALS'));
      cronCheckOut('sync-proposals', checkInId, true);
      return result;
    } catch (error) {
      cronCheckOut('sync-proposals', checkInId, false);
      throw error;
    }
  },
);
