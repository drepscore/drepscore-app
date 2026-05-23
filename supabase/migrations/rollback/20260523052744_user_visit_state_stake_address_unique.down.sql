alter table public.user_visit_state
  drop constraint if exists user_visit_state_stake_address_key;

create unique index if not exists user_visit_state_stake_address_key
  on public.user_visit_state (stake_address)
  where stake_address is not null;
