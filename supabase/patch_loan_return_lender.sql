-- Patch 2026-08-05: allow staff of the LENDING branch (from_branch) to also
-- confirm a loan return, not just staff of the borrowing branch (to_branch).
-- Covers the case where the lender sends someone to physically pick the item
-- back up, rather than the borrower shipping it back.

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
  if my_role() <> 'admin' and (my_role() <> 'staff' or my_branch() not in (t.to_branch, t.from_branch)) then
    raise exception 'Only staff of the borrowing or lending branch can return';
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
