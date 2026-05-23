drop index if exists public.user_visit_state_stake_address_key;

alter table public.user_visit_state
  add constraint user_visit_state_stake_address_key unique (stake_address);
