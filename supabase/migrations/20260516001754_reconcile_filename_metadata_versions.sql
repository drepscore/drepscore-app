BEGIN;

CREATE TABLE IF NOT EXISTS supabase_migrations.audit_filename_metadata_version_reconciliation (
  old_version text NOT NULL,
  new_version text NOT NULL,
  name text,
  statements text[],
  created_by text,
  idempotency_key text,
  rollback text[],
  snapshotted_at timestamptz NOT NULL DEFAULT now(),
  snapshot_reason text NOT NULL,
  PRIMARY KEY (old_version, new_version, snapshot_reason)
);

DO $$
DECLARE
  pending_count integer;
  conflict_count integer;
  unexpected_count integer;
BEGIN
  WITH mapping(old_version, new_version, expected_name) AS (
    VALUES
      ('072', '20260407004742', 'systems_command_center'),
      ('20260508122609', '20260508041000', 'dreps_is_active_column'),
      ('20260509040347', '20260508042713', 'region_suggestion_treasury_majority'),
      ('20260509040359', '20260508043210', 'ack_dismiss_merge'),
      ('20260509210007', '20260509205815', 'repair_unqualified_set_updated_at_in_migration_metadata')
  ),
  states AS (
    SELECT
      m.old_version,
      m.new_version,
      m.expected_name,
      old.version IS NOT NULL AS old_present,
      new.version IS NOT NULL AS new_present
    FROM mapping m
    LEFT JOIN supabase_migrations.schema_migrations old
      ON old.version = m.old_version
     AND old.name = m.expected_name
    LEFT JOIN supabase_migrations.schema_migrations new
      ON new.version = m.new_version
     AND new.name = m.expected_name
  )
  SELECT
    count(*) FILTER (WHERE old_present AND NOT new_present),
    count(*) FILTER (WHERE NOT old_present AND new_present),
    count(*) FILTER (WHERE old_present = new_present)
  INTO pending_count, conflict_count, unexpected_count
  FROM states;

  IF pending_count + conflict_count <> 5 OR unexpected_count <> 0 THEN
    RAISE EXCEPTION
      'F3 preflight failed: expected 5 pending-or-applied mappings, got pending %, already_applied %, unexpected %',
      pending_count,
      conflict_count,
      unexpected_count;
  END IF;

  IF pending_count > 0 AND conflict_count > 0 THEN
    RAISE EXCEPTION
      'F3 preflight failed: mixed metadata state, got pending % and already_applied %',
      pending_count,
      conflict_count;
  END IF;
END $$;

-- The audit snapshot below captures schema_migrations rows before the version
-- rewrite. supabase_migrations.schema_migrations has columns (created_by,
-- idempotency_key, rollback) on the production platform that are ABSENT on a
-- freshly-created Supabase preview-branch database. Referencing them directly
-- fails at parse time on preview branches (column does not exist, SQLSTATE
-- 42703), aborting the whole migration. Guard the snapshot behind a
-- column-existence check and run it via dynamic SQL so those columns are only
-- parsed where they exist. On a preview branch the JOIN matches no rows anyway
-- (the old versions never existed there), so this is a clean no-op. See F16.
DO $f16$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'supabase_migrations'
      AND table_name = 'schema_migrations'
      AND column_name = 'created_by'
  ) THEN
    EXECUTE $snapshot$
      WITH mapping(old_version, new_version, expected_name) AS (
        VALUES
          ('072', '20260407004742', 'systems_command_center'),
          ('20260508122609', '20260508041000', 'dreps_is_active_column'),
          ('20260509040347', '20260508042713', 'region_suggestion_treasury_majority'),
          ('20260509040359', '20260508043210', 'ack_dismiss_merge'),
          ('20260509210007', '20260509205815', 'repair_unqualified_set_updated_at_in_migration_metadata')
      )
      INSERT INTO supabase_migrations.audit_filename_metadata_version_reconciliation
        (old_version, new_version, name, statements, created_by, idempotency_key, rollback, snapshot_reason)
      SELECT
        sm.version,
        m.new_version,
        sm.name,
        sm.statements,
        sm.created_by,
        sm.idempotency_key,
        sm.rollback,
        'F3 filename metadata reconciliation 2026-05-16'
      FROM supabase_migrations.schema_migrations sm
      JOIN mapping m
        ON m.old_version = sm.version
       AND m.expected_name = sm.name
      ON CONFLICT DO NOTHING
    $snapshot$;
  END IF;
END $f16$;

WITH mapping(old_version, new_version, expected_name) AS (
  VALUES
    ('072', '20260407004742', 'systems_command_center'),
    ('20260508122609', '20260508041000', 'dreps_is_active_column'),
    ('20260509040347', '20260508042713', 'region_suggestion_treasury_majority'),
    ('20260509040359', '20260508043210', 'ack_dismiss_merge'),
    ('20260509210007', '20260509205815', 'repair_unqualified_set_updated_at_in_migration_metadata')
)
UPDATE supabase_migrations.schema_migrations sm
SET version = m.new_version
FROM mapping m
WHERE sm.version = m.old_version
  AND sm.name = m.expected_name;

COMMIT;
