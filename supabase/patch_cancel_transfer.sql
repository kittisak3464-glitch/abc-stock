-- Patch 2026-08-05e: let the sending branch cancel a transfer/loan that's
-- still in transit (sent, not yet received) — covers plain Transfers and
-- Requests that have already been approved and sent, since both become
-- an ordinary 'in_transit' row at that point. Fixes mistakes (wrong item,
-- wrong qty, wrong branch) without needing the receiving branch to accept
-- it first and send it back the long way.
--
-- Does NOT reuse void_own_transaction (that path now flatly refuses any
-- transfer-linked entry, on purpose — see patch_undo_blocks_admin_too.sql).
-- Instead this inserts a compensating 'in' transaction, same pattern as
-- send_loan_return/confirm_loan_return, so the audit trail stays intact:
-- you see the original "Sent to X" line and a separate "Transfer
-- cancelled" line, not a vanished/edited entry.

create or replace function public.cancel_transfer(p_transfer_id bigint) returns void
language plpgsql security definer set search_path = public as
$$
declare
  t transfers%rowtype;
  v_item_id int;
begin
  select * into t from transfers where id = p_transfer_id for update;
  if t is null then raise exception 'Transfer not found'; end if;
  if t.status <> 'in_transit' then
    raise exception 'Only a sent-but-not-yet-received transfer can be cancelled';
  end if;
  if my_role() <> 'admin' and (my_role() <> 'staff' or my_branch() <> t.from_branch) then
    raise exception 'Only staff of the sending branch can cancel';
  end if;

  select id into v_item_id from items
    where branch_id = t.from_branch and catalog_id = t.catalog_id for update;
  if v_item_id is null then
    insert into items (branch_id, catalog_id, balance) values (t.from_branch, t.catalog_id, 0)
      returning id into v_item_id;
  end if;

  insert into transactions (item_id, type, qty, note, transfer_id, created_by)
    values (v_item_id, 'in', t.qty, 'Transfer cancelled — returned to stock', t.id, auth.uid());

  update transfers set status = 'cancelled' where id = t.id;
end;
$$;
