-- Session 5: Governance Citizen Experience
-- Tables: governance_stats, governance_events
-- Columns: users engagement tracking

CREATE TABLE IF NOT EXISTS governance_stats (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  treasury_balance_lovelace BIGINT,
  treasury_balance_updated_at TIMESTAMPTZ,
  current_epoch INTEGER,
  epoch_end_time TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE governance_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "governance_stats_public_read" ON governance_stats
  FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS governance_events (
  id BIGSERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  related_drep_id TEXT,
  related_proposal_tx_hash TEXT,
  related_proposal_index INTEGER,
  epoch INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gov_events_wallet ON governance_events(wallet_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gov_events_type ON governance_events(event_type);

ALTER TABLE governance_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "governance_events_own_read" ON governance_events
  FOR SELECT USING (wallet_address = current_setting('request.jwt.claims', true)::jsonb ->> 'wallet_address');
CREATE POLICY "governance_events_service_insert" ON governance_events
  FOR INSERT WITH CHECK (true);

ALTER TABLE users ADD COLUMN IF NOT EXISTS governance_level TEXT DEFAULT 'observer';
ALTER TABLE users ADD COLUMN IF NOT EXISTS poll_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS visit_streak INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_epoch_visited INTEGER;

INSERT INTO governance_stats (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
