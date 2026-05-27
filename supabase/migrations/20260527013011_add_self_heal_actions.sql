CREATE TABLE IF NOT EXISTS public.self_heal_actions (
  id BIGSERIAL PRIMARY KEY,
  class TEXT NOT NULL CHECK (class IN (
    'stale_sync',
    'vendor_degraded',
    'schema_drift',
    'snapshot_gap',
    'persistent_mismatch'
  )),
  signal JSONB NOT NULL,
  action TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  success BOOLEAN,
  escalated BOOLEAN NOT NULL DEFAULT FALSE,
  detail JSONB
);

CREATE INDEX IF NOT EXISTS idx_self_heal_actions_class_started
  ON public.self_heal_actions (class, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_self_heal_actions_started
  ON public.self_heal_actions (started_at DESC);

ALTER TABLE public.self_heal_actions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'self_heal_actions'
      AND policyname = 'self_heal_actions_service_all'
  ) THEN
    CREATE POLICY "self_heal_actions_service_all"
      ON public.self_heal_actions
      TO service_role
      USING (TRUE)
      WITH CHECK (TRUE);
  END IF;
END;
$$;

REVOKE ALL ON TABLE public.self_heal_actions FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.self_heal_actions TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.self_heal_actions_id_seq TO service_role;
