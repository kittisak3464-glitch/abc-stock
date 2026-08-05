-- Patch 2026-08-05c: block undo on transfer/loan-linked transactions for
-- ADMIN too, not just staff. Previously the transfer_id guard only applied
-- inside the "my_role() <> 'admin'" branch, so an admin could void either
-- leg of a paired transfer/loan transaction without warning — exactly what
-- desynced the ABCYQ/LeHong Shower Gel loan (500 units vanished when only
-- one of the two paired transactions got undone). Now nobody, admin
-- included, can undo a transfer/loan-linked entry through this path.

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
  if tx.transfer_id is not null then
    raise exception 'Transfer/loan entries cannot be undone here';
  end if;
  if my_role() <> 'admin' then
    if tx.created_by is distinct from auth.uid() then
      raise exception 'You can only undo your own entry';
    end if;
    if tx.created_at < now() - interval '5 minutes' then
      raise exception 'Undo window (5 minutes) has passed — ask admin';
    end if;
  end if;
  update transactions
    set voided = true, voided_at = now(), voided_by = auth.uid()
    where id = tx_id;
end;
$$;
