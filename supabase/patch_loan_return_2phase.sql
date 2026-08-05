-- Patch 2026-08-05b: two-phase, dual-signed loan return.
--
-- Previously return_loan() moved stock in one unsigned step: whoever clicked
-- it (borrower OR lender staff, since patch_loan_return_lender.sql) both
-- deducted the borrower's stock AND credited the lender's stock at once,
-- with no confirmation from the other side. This splits it into two signed
-- steps, mirroring send_transfer / receive_transfer:
--   1. send_loan_return   — borrowing branch signs to send the goods back
--                           (deducts their stock, status -> return_in_transit)
--   2. confirm_loan_return — lending branch signs to confirm receipt
--                           (credits their stock, status -> returned)
-- This supersedes patch_loan_return_lender.sql's single-step permissiveness:
-- each side now has its own distinct, signed action instead of either side
-- being able to do the whole thing alone.

alter table public.transfers drop constraint transfers_status_check;
alter table public.transfers add constraint transfers_status_check
  check (status in ('requested', 'cancelled', 'declined', 'in_transit', 'received',
                     'pending_return', 'return_in_transit', 'returned', 'waived'));

alter table public.transfers add column return_sent_by uuid references public.profiles (user_id);
alter table public.transfers add column return_sent_at timestamptz;
alter table public.transfers add column return_received_by uuid references public.profiles (user_id);
alter table public.transfers add column return_received_at timestamptz;

drop function if exists public.return_loan(bigint);

-- Step 1: borrowing branch sends the goods back — deducts their stock,
-- loan moves to 'return_in_transit' awaiting the lender's confirmation.
create or replace function public.send_loan_return(p_transfer_id bigint) returns void
language plpgsql security definer set search_path = public as
$$
declare
  t transfers%rowtype;
  v_borrower items%rowtype;
  v_lender_name text;
begin
  select * into t from transfers where id = p_transfer_id for update;
  if t is null then raise exception 'Loan not found'; end if;
  if t.kind <> 'loan' or t.status <> 'pending_return' then raise exception 'Not an outstanding loan'; end if;
  if my_role() <> 'admin' and (my_role() <> 'staff' or my_branch() <> t.to_branch) then
    raise exception 'Only staff of the borrowing branch can send it back';
  end if;

  select * into v_borrower from items
    where branch_id = t.to_branch and catalog_id = t.catalog_id for update;
  if v_borrower is null or v_borrower.balance < t.qty then
    raise exception 'Not enough stock at borrowing branch to return';
  end if;

  select name into v_lender_name from branches where id = t.from_branch;

  insert into transactions (item_id, type, qty, note, transfer_id, created_by)
    values (v_borrower.id, 'out', t.qty, 'Loan returned to ' || v_lender_name, t.id, auth.uid());

  update transfers set
    status = 'return_in_transit', return_sent_by = auth.uid(), return_sent_at = now()
    where id = t.id;
end;
$$;

-- Step 2: lending branch confirms the goods are physically back — credits
-- their stock, loan closes as 'returned'.
create or replace function public.confirm_loan_return(p_transfer_id bigint) returns void
language plpgsql security definer set search_path = public as
$$
declare
  t transfers%rowtype;
  v_lender_item int;
  v_borrower_name text;
begin
  select * into t from transfers where id = p_transfer_id for update;
  if t is null then raise exception 'Loan not found'; end if;
  if t.kind <> 'loan' or t.status <> 'return_in_transit' then
    raise exception 'Not awaiting return confirmation';
  end if;
  if my_role() <> 'admin' and (my_role() <> 'staff' or my_branch() <> t.from_branch) then
    raise exception 'Only staff of the lending branch can confirm receipt';
  end if;

  select id into v_lender_item from items
    where branch_id = t.from_branch and catalog_id = t.catalog_id for update;
  if v_lender_item is null then
    insert into items (branch_id, catalog_id, balance) values (t.from_branch, t.catalog_id, 0)
      returning id into v_lender_item;
  end if;

  select name into v_borrower_name from branches where id = t.to_branch;

  insert into transactions (item_id, type, qty, note, transfer_id, created_by)
    values (v_lender_item, 'in', t.qty, 'Loan returned from ' || v_borrower_name, t.id, auth.uid());

  update transfers set
    status = 'returned', return_received_by = auth.uid(), return_received_at = now()
    where id = t.id;
end;
$$;
