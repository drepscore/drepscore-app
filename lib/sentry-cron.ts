import * as Sentry from '@sentry/nextjs';

/**
 * Start a Sentry Cron Monitor check-in.
 * Returns a checkInId to pass to cronCheckOut when the job finishes.
 */
export function cronCheckIn(slug: string, schedule: string): string {
  return Sentry.captureCheckIn(
    { monitorSlug: slug, status: 'in_progress' },
    {
      schedule: { type: 'crontab', value: schedule },
      checkinMargin: 5,
      maxRuntime: 30,
    },
  );
}

/**
 * Complete a Sentry Cron Monitor check-in.
 */
export function cronCheckOut(slug: string, checkInId: string, ok: boolean): void {
  Sentry.captureCheckIn({
    checkInId,
    monitorSlug: slug,
    status: ok ? 'ok' : 'error',
  });
}
