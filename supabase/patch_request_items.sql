-- Patch 2026-08-05: "Request Items" — a branch can ask another branch to
-- send stock, instead of only the sender being able to initiate a transfer.
-- A request is a transfers row in status='requested' with no stock movement
-- yet. Approving it re-runs send_transfer's balance-check-and-deduct logic
-- and flips it to 'in_transit' — from there receive_transfer (unchanged)
-- handles it exactly like an ordinary transfer.

alter table public.transfers drop constraint transfers_status_check;
alter table public.transfers add constraint transfers_status_check
  check (status in ('requested', 'cancelled', 'declined', 'in_transit', 'received', 'pending_return', 'returned', 'waived'));

alter table public.transfers add column requested_by uuid references public.profiles (user_id);
alter table public.transfers add column requested_at timestamptz;
alter table public.transfers add column decline_reason text;

-- Lets a requester see on-hand balance at another branch before asking —
-- items_read RLS restricts staff to their own branch, so this scoped
-- SECURITY DEFINER function is the exception, exposing only qty (no names).
create or replace function public.branch_stock(p_branch_id int)
returns table (catalog_id int, balance numeric)
language sql stable security definer set search_path = public as
$$
  select catalog_id, balance from items where branch_id = p_branch_id
$$;

-- Inverse of branch_stock: one item's balance across every branch, so a
-- requester whose first-choice branch is short can see who else has it.
create or replace function public.item_branch_stock(p_catalog_id int)
returns table (branch_id int, balance numeric)
language sql stable security definer set search_path = public as
$$
  select branch_id, balance from items where catalog_id = p_catalog_id
$$;

-- Ask another branch to send stock — no balance check, nothing moves yet.
create or replace function public.request_transfer(
  p_from_branch int, p_to_branch int, p_catalog_id int, p_qty numeric, p_note text default null
) returns bigint
language plpgsql security definer set search_path = public as
$$
declare
  v_from_group int; v_to_group int; v_kind text; v_tid bigint;
begin
  if p_qty is null or p_qty <= 0 then raise exception 'Quantity must be positive'; end if;
  if p_from_branch = p_to_branch then raise exception 'Choose two different branches'; end if;
  if my_role() not in ('admin', 'staff') then raise exception 'Not allowed'; end if;
  if my_role() = 'staff' and my_branch() <> p_to_branch then
    raise exception 'You can only request for your own branch';
  end if;

  select procurement_group into v_from_group from branches where id = p_from_branch;
  select procurement_group into v_to_group from branches where id = p_to_branch;
  if v_from_group is null or v_to_group is null then raise exception 'Unknown branch'; end if;
  v_kind := case when v_from_group = v_to_group then 'transfer' else 'loan' end;

  insert into transfers (from_branch, to_branch, catalog_id, qty, kind, status, note, requested_by, requested_at)
    values (p_from_branch, p_to_branch, p_catalog_id, p_qty, v_kind, 'requested', p_note, auth.uid(), now())
    returning id into v_tid;

  return v_tid;
end;
$$;

-- Source branch fulfills a request: deduct stock, become an in-flight
-- transfer. Mirrors send_transfer's balance check and transaction insert.
create or replace function public.approve_request(p_transfer_id bigint) returns void
language plpgsql security definer set search_path = public as
$$
declare
  t transfers%rowtype;
  v_item items%rowtype;
  v_to_name text;
begin
  select * into t from transfers where id = p_transfer_id for update;
  if t is null then raise exception 'Request not found'; end if;
  if t.status <> 'requested' then raise exception 'Already handled'; end if;
  if my_role() not in ('admin', 'staff') then raise exception 'Not allowed'; end if;
  if my_role() = 'staff' and my_branch() <> t.from_branch then
    raise exception 'Only staff of the requested branch can approve';
  end if;

  select * into v_item from items
    where branch_id = t.from_branch and catalog_id = t.catalog_id for update;
  if v_item is null then raise exception 'Item not stocked at source branch'; end if;
  if v_item.balance < t.qty then
    raise exception 'Not enough stock — on hand is %', v_item.balance;
  end if;

  select name into v_to_name from branches where id = t.to_branch;

  insert into transactions (item_id, type, qty, note, transfer_id, created_by)
    values (v_item.id, 'out', t.qty, 'Sent to ' || v_to_name, t.id, auth.uid());

  update transfers set status = 'in_transit', sent_by = auth.uid(), sent_at = now()
    where id = t.id;
end;
$$;

-- Source branch declines a request — nothing ever moved, so no signature needed.
create or replace function public.decline_request(p_transfer_id bigint, p_reason text default null) returns void
language plpgsql security definer set search_path = public as
$$
declare t transfers%rowtype;
begin
  select * into t from transfers where id = p_transfer_id for update;
  if t is null then raise exception 'Request not found'; end if;
  if t.status <> 'requested' then raise exception 'Already handled'; end if;
  if my_role() not in ('admin', 'staff') then raise exception 'Not allowed'; end if;
  if my_role() = 'staff' and my_branch() <> t.from_branch then
    raise exception 'Only staff of the requested branch can decline';
  end if;

  update transfers set status = 'declined', decline_reason = p_reason where id = t.id;
end;
$$;

-- Requester withdraws their own still-pending request.
create or replace function public.cancel_request(p_transfer_id bigint) returns void
language plpgsql security definer set search_path = public as
$$
declare t transfers%rowtype;
begin
  select * into t from transfers where id = p_transfer_id for update;
  if t is null then raise exception 'Request not found'; end if;
  if t.status <> 'requested' then raise exception 'Already handled'; end if;
  if my_role() <> 'admin' and t.requested_by is distinct from auth.uid() then
    raise exception 'You can only cancel your own request';
  end if;

  update transfers set status = 'cancelled' where id = t.id;
end;
$$;
