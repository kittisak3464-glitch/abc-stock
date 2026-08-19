-- Patch 2026-08-19: let the borrowing branch (or admin) cancel a loan
-- return they sent back by mistake, while it's still awaiting the lender's
-- confirmation (status = 'return_in_transit'). Previously there was no way
-- to undo an accidental "Send Back" click — the loan just sat stuck until
-- the lender confirmed it, which would have wrongly completed a return that
-- never physically happened.
--
-- Mirrors cancel_transfer's compensating-transaction pattern (never
-- edits/voids the original 'out' entry, inserts a matching 'in' entry
-- instead) so the audit trail stays paired and intact. Puts the transfer
-- back to 'pending_return' — i.e. exactly the state it was in before the
-- mistaken send — rather than a terminal 'cancelled' state, since the loan
-- itself is still outstanding and can be sent back again properly later.

create or replace function public.cancel_loan_return(p_transfer_id bigint) returns void
language plpgsql security definer set search_path = public as
$$
declare
  t transfers%rowtype;
  v_borrower_item int;
begin
  select * into t from transfers where id = p_transfer_id for update;
  if t is null then raise exception 'Loan not found'; end if;
  if t.kind <> 'loan' or t.status <> 'return_in_transit' then
    raise exception 'Not awaiting return confirmation';
  end if;
  if my_role() <> 'admin' and (my_role() <> 'staff' or my_branch() <> t.to_branch) then
    raise exception 'Only staff of the borrowing branch can cancel their own return';
  end if;

  select id into v_borrower_item from items
    where branch_id = t.to_branch and catalog_id = t.catalog_id for update;
  if v_borrower_item is null then
    insert into items (branch_id, catalog_id, balance) values (t.to_branch, t.catalog_id, 0)
      returning id into v_borrower_item;
  end if;

  insert into transactions (item_id, type, qty, note, transfer_id, created_by)
    values (v_borrower_item, 'in', t.qty, 'Loan return cancelled — stock restored', t.id, auth.uid());

  update transfers set
    status = 'pending_return', return_sent_by = null, return_sent_at = null
    where id = t.id;
end;
$$;
