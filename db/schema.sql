-- =====================================================
-- Brandmaster — схема Supabase (Postgres)
-- Запустить в SQL Editor проекта Supabase один раз.
-- Модель данных взята из Раздела 5 developer brief.
-- =====================================================

-- Пользователи — Supabase Auth уже создаёт auth.users.
-- Здесь храним прикладную инфу (role и т.п.).
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'user',  -- 'user' | 'admin'
  created_at timestamptz default now()
);

-- Ответы стратегии — key/value по блокам
create table if not exists public.strategy_answers (
  user_id uuid not null references auth.users(id) on delete cascade,
  block_key text not null,           -- b1_q1, b2_q9 и т.п.
  value text,
  updated_at timestamptz default now(),
  primary key (user_id, block_key)
);

-- Продукты эксперта
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  concept text,
  unique_value text,
  audience text,
  marketing_result text,
  order_index int default 0,
  created_at timestamptz default now()
);

create table if not exists public.product_tasks (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  text text,
  order_index int default 0
);

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  type text,                         -- знания | навыки | материалы | результаты | другое
  order_index int default 0
);

create table if not exists public.category_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.product_categories(id) on delete cascade,
  text text,
  order_index int default 0
);

-- Задачи на неделю
create table if not exists public.weekly_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_key text not null,            -- w_2026_4_3
  text text,
  is_done boolean default false,
  order_index int default 0,
  created_at timestamptz default now()
);

-- Банк идей
create table if not exists public.ideas_bank (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tab text not null,                 -- expert | personal | fun
  fmt text,
  platform text,                     -- ig | th | yt | tt
  title text,
  description text,
  source text default 'user',        -- ai | user
  scheduled_date date,
  created_at timestamptz default now()
);

-- Контент-календарь
create table if not exists public.content_calendar (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null,            -- ig | th | yt | tt
  fmt text,
  title text,
  idea_text text,
  scheduled_date date,
  created_at timestamptz default now()
);

-- =====================================================
-- Row Level Security — каждый пользователь видит только своё
-- =====================================================
alter table public.profiles          enable row level security;
alter table public.strategy_answers  enable row level security;
alter table public.products          enable row level security;
alter table public.weekly_tasks      enable row level security;
alter table public.ideas_bank        enable row level security;
alter table public.content_calendar  enable row level security;

create policy "own profile"   on public.profiles          for all using (auth.uid() = id);
create policy "own answers"   on public.strategy_answers  for all using (auth.uid() = user_id);
create policy "own products"  on public.products          for all using (auth.uid() = user_id);
create policy "own tasks"     on public.weekly_tasks      for all using (auth.uid() = user_id);
create policy "own ideas"     on public.ideas_bank        for all using (auth.uid() = user_id);
create policy "own calendar"  on public.content_calendar  for all using (auth.uid() = user_id);

-- Админ видит всё (для участников воркшопа)
create policy "admin all profiles"  on public.profiles         for select using ((select role from public.profiles where id = auth.uid()) = 'admin');
create policy "admin all answers"   on public.strategy_answers for select using ((select role from public.profiles where id = auth.uid()) = 'admin');

-- =====================================================
-- Триггер: при регистрации создаём строку в profiles
-- =====================================================
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
