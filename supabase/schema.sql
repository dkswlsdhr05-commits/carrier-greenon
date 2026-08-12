begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'GreenON 사용자',
  green_level text not null default 'SEED' check (green_level in ('SEED', 'SPROUT', 'TREE', 'FOREST')),
  lifetime_points integer not null default 0 check (lifetime_points >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text not null,
  target_minutes integer not null check (target_minutes > 0),
  minimum_temperature numeric(4,1) not null default 26,
  required_mode text not null default 'cool',
  reward_points integer not null check (reward_points > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.user_missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_id uuid not null references public.missions(id) on delete restrict,
  mission_date date not null default current_date,
  status text not null default 'active' check (status in ('ready', 'active', 'success', 'failed')),
  progress_minutes integer not null default 0 check (progress_minutes >= 0),
  reward_claimed boolean not null default false,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, mission_id, mission_date)
);

create table if not exists public.point_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('earn', 'spend')),
  amount integer not null check (
    (type = 'earn' and amount > 0)
    or (type = 'spend' and amount < 0)
  ),
  title text not null,
  reference_type text,
  reference_id uuid,
  created_at timestamptz not null default now()
);

create unique index if not exists point_transactions_unique_reference
  on public.point_transactions (user_id, reference_type, reference_id)
  where reference_id is not null;

create index if not exists point_transactions_user_created_idx
  on public.point_transactions (user_id, created_at desc);

create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  category text not null check (category in ('food', 'life', 'carrier')),
  name text not null,
  description text not null,
  price integer not null check (price > 0),
  icon text not null,
  is_active boolean not null default true,
  stock integer check (stock is null or stock >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.reward_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reward_id uuid not null references public.rewards(id) on delete restrict,
  price integer not null check (price > 0),
  status text not null default 'completed' check (status in ('completed', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists reward_orders_user_created_idx
  on public.reward_orders (user_id, created_at desc);

create index if not exists reward_orders_reward_id_idx
  on public.reward_orders (reward_id);

create index if not exists user_missions_mission_id_idx
  on public.user_missions (mission_id);

create table if not exists public.aircon_status (
  user_id uuid primary key references auth.users(id) on delete cascade,
  power boolean not null default true,
  mode text not null default 'cool' check (mode in ('cool', 'dry', 'fan')),
  temperature numeric(4,1) not null default 26 check (temperature between 18 and 30),
  fan text not null default 'auto' check (fan in ('auto', 'low', 'high')),
  usage_minutes integer not null default 0 check (usage_minutes >= 0),
  filter_level integer not null default 82 check (filter_level between 0 and 100),
  error_code text not null default 'none' check (error_code in ('none', 'filter', 'sensor')),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.missions enable row level security;
alter table public.user_missions enable row level security;
alter table public.point_transactions enable row level security;
alter table public.rewards enable row level security;
alter table public.reward_orders enable row level security;
alter table public.aircon_status enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "missions_read_authenticated" on public.missions;
create policy "missions_read_authenticated" on public.missions
  for select to authenticated
  using (is_active = true);

drop policy if exists "user_missions_select_own" on public.user_missions;
create policy "user_missions_select_own" on public.user_missions
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "user_missions_insert_own" on public.user_missions;
create policy "user_missions_insert_own" on public.user_missions
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and status in ('ready', 'active')
    and reward_claimed = false
  );

drop policy if exists "user_missions_update_own" on public.user_missions;
create policy "user_missions_update_own" on public.user_missions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "point_transactions_select_own" on public.point_transactions;
create policy "point_transactions_select_own" on public.point_transactions
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "rewards_read_authenticated" on public.rewards;
create policy "rewards_read_authenticated" on public.rewards
  for select to authenticated
  using (is_active = true);

drop policy if exists "reward_orders_select_own" on public.reward_orders;
create policy "reward_orders_select_own" on public.reward_orders
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "reward_orders_insert_own" on public.reward_orders;
create policy "reward_orders_insert_own" on public.reward_orders
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "aircon_status_select_own" on public.aircon_status;
create policy "aircon_status_select_own" on public.aircon_status
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "aircon_status_insert_own" on public.aircon_status;
create policy "aircon_status_insert_own" on public.aircon_status
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "aircon_status_update_own" on public.aircon_status;
create policy "aircon_status_update_own" on public.aircon_status
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant usage on schema public to authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select on public.missions to authenticated;
grant select, insert on public.user_missions to authenticated;
grant update (status, progress_minutes) on public.user_missions to authenticated;
grant select on public.point_transactions to authenticated;
grant select on public.rewards to authenticated;
grant select, insert on public.reward_orders to authenticated;
grant select, insert on public.aircon_status to authenticated;
grant update (power, mode, temperature, fan, usage_minutes, filter_level, error_code, updated_at)
  on public.aircon_status to authenticated;

revoke all on public.profiles from anon;
revoke all on public.missions from anon;
revoke all on public.user_missions from anon;
revoke all on public.point_transactions from anon;
revoke all on public.rewards from anon;
revoke all on public.reward_orders from anon;
revoke all on public.aircon_status from anon;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1), 'GreenON 사용자')
  )
  on conflict (id) do nothing;

  insert into public.aircon_status (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

insert into public.profiles (id, display_name)
select
  id,
  coalesce(nullif(raw_user_meta_data ->> 'display_name', ''), split_part(email, '@', 1), 'GreenON 사용자')
from auth.users
on conflict (id) do nothing;

insert into public.aircon_status (user_id)
select id from auth.users
on conflict (user_id) do nothing;

create or replace function private.reward_completed_mission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  mission_reward integer;
  target_duration integer;
  inserted_count integer;
begin
  if new.status = 'success' and old.status is distinct from 'success' then
    select reward_points, target_minutes
      into mission_reward, target_duration
      from public.missions
      where id = new.mission_id and is_active = true;

    if mission_reward is null then
      raise exception 'mission_not_available';
    end if;

    if new.progress_minutes < target_duration then
      raise exception 'mission_progress_incomplete';
    end if;

    insert into public.point_transactions (
      user_id, type, amount, title, reference_type, reference_id
    )
    select
      new.user_id, 'earn', mission_reward, m.title, 'mission', new.id
    from public.missions m
    where m.id = new.mission_id
    on conflict (user_id, reference_type, reference_id)
      where reference_id is not null
      do nothing;

    get diagnostics inserted_count = row_count;

    if inserted_count = 1 then
      update public.profiles
      set
        lifetime_points = lifetime_points + mission_reward,
        green_level = case
          when lifetime_points + mission_reward >= 1000 then 'FOREST'
          when lifetime_points + mission_reward >= 500 then 'TREE'
          when lifetime_points + mission_reward >= 100 then 'SPROUT'
          else 'SEED'
        end,
        updated_at = now()
      where id = new.user_id;
    end if;

    new.reward_claimed = true;
    new.completed_at = now();
  end if;

  return new;
end;
$$;

revoke all on function private.reward_completed_mission() from public, anon, authenticated;

drop trigger if exists reward_on_mission_success on public.user_missions;
create trigger reward_on_mission_success
  before update on public.user_missions
  for each row execute function private.reward_completed_mission();

create or replace function private.process_reward_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  reward_price integer;
  reward_name text;
  current_balance integer;
begin
  if (select auth.uid()) is null or (select auth.uid()) <> new.user_id then
    raise exception 'unauthorized_order';
  end if;

  select price, name
    into reward_price, reward_name
    from public.rewards
    where id = new.reward_id
      and is_active = true
      and (stock is null or stock > 0)
    for update;

  if reward_price is null then
    raise exception 'reward_not_available';
  end if;

  select coalesce(sum(amount), 0)
    into current_balance
    from public.point_transactions
    where user_id = new.user_id;

  if current_balance < reward_price then
    raise exception 'insufficient_points';
  end if;

  new.price = reward_price;
  new.status = 'completed';
  new.created_at = now();

  insert into public.point_transactions (
    user_id, type, amount, title, reference_type, reference_id
  )
  values (
    new.user_id, 'spend', -reward_price, reward_name, 'reward_order', new.id
  );

  update public.rewards
  set stock = stock - 1
  where id = new.reward_id and stock is not null;

  return new;
end;
$$;

revoke all on function private.process_reward_order() from public, anon, authenticated;

drop trigger if exists process_reward_order_before_insert on public.reward_orders;
create trigger process_reward_order_before_insert
  before insert on public.reward_orders
  for each row execute function private.process_reward_order();

insert into public.missions (
  code, title, description, target_minutes, minimum_temperature, required_mode, reward_points
)
values (
  'daily-26c',
  '26°C 건강 냉방 챌린지',
  '에어컨을 26°C 이상으로 설정하고 60분 동안 친환경 냉방을 유지해요.',
  60,
  26,
  'cool',
  100
)
on conflict (code) do update set
  title = excluded.title,
  description = excluded.description,
  target_minutes = excluded.target_minutes,
  minimum_temperature = excluded.minimum_temperature,
  required_mode = excluded.required_mode,
  reward_points = excluded.reward_points,
  is_active = true;

insert into public.rewards (code, category, name, description, price, icon)
values
  ('food-drink', 'food', '저탄소 과일 음료', '가볍게 즐기는 저탄소 인증 과일 음료 모바일 교환권이에요.', 80, '🧃'),
  ('food-snack', 'food', '유기농 간식 세트', '환경을 생각한 포장에 담긴 유기농 간식 세트예요.', 140, '🍪'),
  ('life-towel', 'life', '친환경 주방 타월', '재생 섬유로 만들어 오래 사용할 수 있는 주방 타월이에요.', 120, '🧺'),
  ('life-tumbler', 'life', 'GreenON 텀블러', '일회용 컵 사용을 줄여 주는 GreenON 전용 텀블러예요.', 220, '🥤'),
  ('carrier-filter', 'carrier', '에어컨 필터 할인권', '캐리어 에어컨 정품 필터 구매에 사용할 수 있는 할인권이에요.', 300, '❄️'),
  ('carrier-care', 'carrier', 'Green Care 점검권', '쾌적한 냉방을 위한 캐리어 에어컨 가상 점검 리워드예요.', 500, '🛠️')
on conflict (code) do update set
  category = excluded.category,
  name = excluded.name,
  description = excluded.description,
  price = excluded.price,
  icon = excluded.icon,
  is_active = true;

commit;
