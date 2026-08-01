-- Patch 2026-08-01: staff can no longer record Stock In directly — admin only.
-- Staff keep Stock Out. Transfer receipts still work (they go through the
-- receive_transfer/return_loan SECURITY DEFINER functions, not direct inserts).

drop policy tx_insert on public.transactions;

create policy tx_insert on public.transactions for insert to authenticated
  with check (
    my_role() = 'admin'
    or (
      my_role() = 'staff'
      and type = 'out'
      and created_by = auth.uid()
      and voided = false
      and exists (select 1 from items i where i.id = item_id and i.branch_id = my_branch())
    )
  );
