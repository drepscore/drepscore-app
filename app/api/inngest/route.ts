import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest';
import { syncProposals } from '@/inngest/functions/sync-proposals';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [syncProposals],
});
