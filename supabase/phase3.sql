-- ============================================================
-- ABC Stock — Phase 3: transfer / loan functions
-- Run in Supabase SQL Editor after schema.sql
-- All writes go through these SECURITY DEFINER functions;
-- the caller's JWT identity is the "signature" (sent_by / received_by).
-- ============================================================

-- Send: deduct source stock, create transfer as in_transit.
-- Same procurement group -> 'transfer', cross-group -> 'loan'.
create or replace function public.send_transfer(
  p_from_branch int, p_to_branch int, p_catalog_id int, p_qty numeric, p_note text default null
) returns bigint
language plpgsql security definer set search_path = public as
$$
declare
  v_item items%rowtype;
  v_from_group int; v_to_group int;
  v_kind text; v_tid bigint; v_to_name text;
begin
  if p_qty is null or p_qty <= 0 then raise exception 'Quantity must be positive'; end if;
  if p_from_branch = p_to_branch then raise exception 'Choose two different branches'; end if;
  if my_role() not in ('admin', 'staff') then raise exception 'Not allowed'; end if;
  if my_role() = 'staff' and my_branch() <> p_from_branch then
    raise exception 'You can only send from your own branch';
  end if;

  select * into v_item from items
    where branch_id = p_from_branch and catalog_id = p_catalog_id for update;
  if v_item is null then raise exception 'Item not stocked at source branch'; end if;
  if v_item.balance < p_qty then
    raise exception 'Not enough stock — on hand is %', v_item.balance;
  end if;

  select procurement_group into v_from_group from branches where id = p_from_branch;
  select procurement_group, name into v_to_group, v_to_name from branches where id = p_to_branch;
  v_kind := case when v_from_group = v_to_group then 'transfer' else 'loan' end;

  insert into transfers (from_branch, to_branch, catalog_id, qty, kind, status, note, sent_by, sent_at)
    values (p_from_branch, p_to_branch, p_catalog_id, p_qty, v_kind, 'in_transit', p_note, auth.uid(), now())
    returning id into v_tid;

  insert into transactions (item_id, type, qty, note, transfer_id, created_by)
    values (v_item.id, 'out', p_qty, 'Sent to ' || v_to_name, v_tid, auth.uid());

  return v_tid;
end;
$$;

-- Receive: caller must belong to destination branch (or admin).
-- Adds stock at destination; loan becomes pending_return.
create or replace function public.receive_transfer(p_transfer_id bigint) returns void
language plpgsql security definer set search_path = public as
$$
declare
  t transfers%rowtype;
  v_item_id int; v_from_name text;
begin
  select * into t from transfers where id = p_transfer_id for update;
  if t is null then raise exception 'Transfer not found'; end if;
  if t.status <> 'in_transit' then raise exception 'Already received'; end if;
  if my_role() <> 'admin' and (my_role() <> 'staff' or my_branch() <> t.to_branch) then
    raise exception 'Only staff of the receiving branch can confirm';
  end if;

  select id into v_item_id from items
    where branch_id = t.to_branch and catalog_id = t.catalog_id for update;
  if v_item_id is null then
    insert into items (branch_id, catalog_id, balance) values (t.to_branch, t.catalog_id, 0)
      returning id into v_item_id;
  end if;

  select name into v_from_name from branches where id = t.from_branch;

  insert into transactions (item_id, type, qty, note, transfer_id, created_by)
    values (v_item_id, 'in', t.qty, 'Received from ' || v_from_name, t.id, auth.uid());

  update transfers set
    status = case when kind = 'loan' then 'pending_return' else 'received' end,
    received_by = auth.uid(), received_at = now()
    where id = t.id;
end;
$$;

-- Return a loan: borrower branch sends the goods back (single action).
create or replace function public.return_loan(p_transfer_id bigint) returns void
language plpgsql security definer set search_path = public as
$$
declare
  t transfers%rowtype;
  v_borrower items%rowtype;
  v_lender_item int;
  v_lender_name text; v_borrower_name text;
begin
  select * into t from transfers where id = p_transfer_id for update;
  if t is null then raise exception 'Loan not found'; end if;
  if t.kind <> 'loan' or t.status <> 'pending_return' then raise exception 'Not an outstanding loan'; end if;
  if my_role() <> 'admin' and (my_role() <> 'staff' or my_branch() <> t.to_branch) then
    raise exception 'Only staff of the borrowing branch can return';
  end if;

  select * into v_borrower from items
    where branch_id = t.to_branch and catalog_id = t.catalog_id for update;
  if v_borrower is null or v_borrower.balance < t.qty then
    raise exception 'Not enough stock at borrowing branch to return';
  end if;

  select id into v_lender_item from items
    where branch_id = t.from_branch and catalog_id = t.catalog_id for update;
  if v_lender_item is null then
    insert into items (branch_id, catalog_id, balance) values (t.from_branch, t.catalog_id, 0)
      returning id into v_lender_item;
  end if;

  select name into v_lender_name from branches where id = t.from_branch;
  select name into v_borrower_name from branches where id = t.to_branch;

  insert into transactions (item_id, type, qty, note, transfer_id, created_by)
    values (v_borrower.id, 'out', t.qty, 'Loan returned to ' || v_lender_name, t.id, auth.uid());
  insert into transactions (item_id, type, qty, note, transfer_id, created_by)
    values (v_lender_item, 'in', t.qty, 'Loan returned from ' || v_borrower_name, t.id, auth.uid());

  update transfers set status = 'returned' where id = t.id;
end;
$$;

-- Waive a loan: admin only — debt cleared, nothing moves.
create or replace function public.waive_loan(p_transfer_id bigint) returns void
language plpgsql security definer set search_path = public as
$$
declare t transfers%rowtype;
begin
  if my_role() <> 'admin' then raise exception 'Admin only'; end if;
  select * into t from transfers where id = p_transfer_id for update;
  if t is null or t.kind <> 'loan' or t.status <> 'pending_return' then
    raise exception 'Not an outstanding loan';
  end if;
  update transfers set status = 'waived' where id = t.id;
end;
$$;
