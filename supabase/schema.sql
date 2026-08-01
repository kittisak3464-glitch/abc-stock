-- ============================================================
-- ABC Stock — Database schema (Phase 1)
-- Run this whole file in Supabase SQL Editor (once, on a fresh project)
-- ============================================================

-- ---------- Tables ----------

create table public.branches (
  id          serial primary key,
  code        text not null unique,          -- ABCYQ, ABCSO, ABCHA, ABCQQ, LEHONG
  name        text not null,
  procurement_group int not null check (procurement_group in (1, 2))
);

create table public.catalog (
  id     serial primary key,
  name   text not null unique,               -- locked master item names (admin only)
  unit   text not null,
  active boolean not null default true
);

create table public.profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  role         text not null check (role in ('admin', 'staff', 'owner')),
  branch_id    int references public.branches (id),   -- null for admin/owner
  lang         text not null default 'en' check (lang in ('en', 'th', 'zh'))
);

create table public.items (
  id            serial primary key,
  branch_id     int not null references public.branches (id),
  catalog_id    int not null references public.catalog (id),
  balance       numeric not null default 0,
  reorder_point numeric,
  unique (branch_id, catalog_id)
);

create table public.transfers (
  id          bigserial primary key,
  from_branch int not null references public.branches (id),
  to_branch   int not null references public.branches (id),
  catalog_id  int not null references public.catalog (id),
  qty         numeric not null check (qty > 0),
  kind        text not null check (kind in ('transfer', 'loan')),
  status      text not null check (status in ('in_transit', 'received', 'pending_return', 'returned', 'waived')),
  note        text,
  sent_by     uuid references public.profiles (user_id),
  received_by uuid references public.profiles (user_id),
  sent_at     timestamptz,
  received_at timestamptz,
  check (from_branch <> to_branch)
);

create table public.transactions (
  id           bigserial primary key,
  item_id      int not null references public.items (id),
  type         text not null check (type in ('in', 'out')),
  qty          numeric not null check (qty > 0),
  note         text,
  transfer_id  bigint references public.transfers (id),
  created_by   uuid references public.profiles (user_id),  -- null = migrated from old system
  created_at   timestamptz not null default now(),
  voided       boolean not null default false,
  voided_at    timestamptz,
  voided_by    uuid references public.profiles (user_id),
  legacy_tx_id int                                          -- tx_id from old inventory.json
);

create index on public.transactions (item_id, created_at desc);
create index on public.transactions (created_by, created_at desc);

-- ---------- Helper functions ----------

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as
$$ select role from profiles where user_id = auth.uid() $$;

create or replace function public.my_branch() returns int
language sql stable security definer set search_path = public as
$$ select branch_id from profiles where user_id = auth.uid() $$;

-- ---------- Balance trigger ----------
-- Balance is ONLY ever changed here. No client writes items.balance directly.

create or replace function public.apply_transaction() returns trigger
language plpgsql security definer set search_path = public as
$$
begin
  if tg_op = 'INSERT' then
    if new.voided then
      return new;  -- never insert pre-voided rows
    end if;
    update items
      set balance = balance + (case when new.type = 'in' then new.qty else -new.qty end)
      where id = new.item_id;
  elsif tg_op = 'UPDATE' and old.voided = false and new.voided = true then
    -- voiding reverses the stock effect
    update items
      set balance = balance - (case when new.type = 'in' then new.qty else -new.qty end)
      where id = new.item_id;
  end if;
  return new;
end;
$$;

create trigger trg_apply_transaction
after insert or update on public.transactions
for each row execute function public.apply_transaction();

-- ---------- Undo within 5 minutes ----------

create or replace function public.void_own_transaction(tx_id bigint) returns void
language plpgsql security definer set search_path = public as
$$
declare tx record;
begin
  select * into tx from transactions where id = tx_id;
  if tx is null then
    raise exception 'Transaction not found';
  end if;
  if tx.voided then
    raise exception 'Already undone';
  end if;
  if my_role() <> 'admin' then
    if tx.created_by is distinct from auth.uid() then
      raise exception 'You can only undo your own entry';
    end if;
    if tx.created_at < now() - interval '5 minutes' then
      raise exception 'Undo window (5 minutes) has passed — ask admin';
    end if;
    if tx.transfer_id is not null then
      raise exception 'Transfer entries cannot be undone here';
    end if;
  end if;
  update transactions
    set voided = true, voided_at = now(), voided_by = auth.uid()
    where id = tx_id;
end;
$$;

-- ---------- Row Level Security ----------

alter table public.branches     enable row level security;
alter table public.catalog      enable row level security;
alter table public.profiles     enable row level security;
alter table public.items        enable row level security;
alter table public.transactions enable row level security;
alter table public.transfers    enable row level security;

-- branches: everyone logged-in can read; only admin writes
create policy branches_read  on public.branches for select to authenticated using (true);
create policy branches_admin on public.branches for all to authenticated
  using (my_role() = 'admin') with check (my_role() = 'admin');

-- catalog: everyone reads; ONLY admin adds/renames/removes (locked item names)
create policy catalog_read  on public.catalog for select to authenticated using (true);
create policy catalog_admin on public.catalog for all to authenticated
  using (my_role() = 'admin') with check (my_role() = 'admin');

-- profiles: everyone reads display names; only admin manages
create policy profiles_read  on public.profiles for select to authenticated using (true);
create policy profiles_admin on public.profiles for all to authenticated
  using (my_role() = 'admin') with check (my_role() = 'admin');

-- items: admin/owner see all; staff see own branch only; only admin writes rows
create policy items_read on public.items for select to authenticated
  using (my_role() in ('admin', 'owner') or branch_id = my_branch());
create policy items_admin on public.items for all to authenticated
  using (my_role() = 'admin') with check (my_role() = 'admin');

-- transactions: admin/owner see all; staff see own branch
create policy tx_read on public.transactions for select to authenticated
  using (
    my_role() in ('admin', 'owner')
    or exists (select 1 from items i where i.id = item_id and i.branch_id = my_branch())
  );
-- insert: admin anywhere; staff only own branch, only as themselves
create policy tx_insert on public.transactions for insert to authenticated
  with check (
    my_role() = 'admin'
    or (
      my_role() = 'staff'
      and created_by = auth.uid()
      and voided = false
      and exists (select 1 from items i where i.id = item_id and i.branch_id = my_branch())
    )
  );
-- direct update: admin only (staff undo goes through void_own_transaction())
create policy tx_update_admin on public.transactions for update to authenticated
  using (my_role() = 'admin') with check (my_role() = 'admin');

-- transfers: admin/owner see all; staff see transfers touching own branch
create policy tf_read on public.transfers for select to authenticated
  using (
    my_role() in ('admin', 'owner')
    or my_branch() in (from_branch, to_branch)
  );
-- Phase 1: only admin writes transfers (send/receive functions come in Phase 3)
create policy tf_admin on public.transfers for all to authenticated
  using (my_role() = 'admin') with check (my_role() = 'admin');

-- ---------- Seed branches ----------

insert into public.branches (code, name, procurement_group) values
  ('ABCYQ',  'ABCYQ',   1),
  ('ABCSO',  'ABCSO',   1),
  ('ABCHA',  'ABCHA',   1),
  ('ABCQQ',  'ABCQQ',   2),
  ('LEHONG', 'Le Hong', 2);
