import { UserPrefKey } from './drep';

export interface SupabaseUser {
  wallet_address: string;
  connected_wallets: string[];
  display_name?: string;
  prefs: {
    userPrefs?: UserPrefKey[];
    hasSeenOnboarding?: boolean;
  };
  watchlist: string[];
  delegation_history: DelegationRecord[];
  push_subscriptions: PushSubscriptionData;
  last_active: string;
  claimed_drep_id?: string;
}

export interface DelegationRecord {
  drepId: string;
  timestamp: string;
  txHash?: string;
}

export interface PushSubscriptionData {
  endpoint?: string;
  keys?: {
    p256dh: string;
    auth: string;
  };
  subscribed_at?: string;
}

export type SupabaseUserUpdate = Partial<Omit<SupabaseUser, 'wallet_address'>>;
