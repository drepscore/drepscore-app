CREATE TABLE IF NOT EXISTS public.quarantined_metrics (
  metric TEXT PRIMARY KEY,
  quarantined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  reason TEXT NOT NULL,
  consecutive_count INTEGER NOT NULL DEFAULT 0 CHECK (consecutive_count >= 0),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  surfaced_to_users BOOLEAN NOT NULL DEFAULT TRUE,
  source TEXT NOT NULL DEFAULT 'persistent_mismatch' CHECK (source IN ('persistent_mismatch', 'manual'))
);

CREATE INDEX IF NOT EXISTS idx_quarantined_metrics_expires
  ON public.quarantined_metrics (expires_at)
  WHERE expires_at IS NOT NULL;

ALTER TABLE public.quarantined_metrics ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'quarantined_metrics'
      AND policyname = 'quarantined_metrics_service_all'
  ) THEN
    CREATE POLICY "quarantined_metrics_service_all"
      ON public.quarantined_metrics
      TO service_role
      USING (TRUE)
      WITH CHECK (TRUE);
  END IF;
END;
$$;

REVOKE ALL ON TABLE public.quarantined_metrics FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.quarantined_metrics TO service_role;
