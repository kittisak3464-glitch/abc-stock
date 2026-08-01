-- Patch 2026-08-01: admin-only balance adjustment (stock count correction)
-- Never writes items.balance directly — creates a normal transaction so the
-- audit trail (balance = sum of transactions) is never broken. Reason is
-- required and stored in the note, prefixed so History reads clearly.

create or replace function public.adjust_balance(p_item_id int, p_new_balance numeric, p_reason text)
returns void
language plpgsql security definer set search_path = public as
$$
declare
  v_item items%rowtype;
  v_diff numeric;
begin
  if my_role() <> 'admin' then
    raise exception 'Admin only';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Reason is required';
  end if;
  if p_new_balance < 0 then
    raise exception 'Balance cannot be negative';
  end if;

  select * into v_item from items where id = p_item_id for update;
  if v_item is null then raise exception 'Item not found'; end if;

  v_diff := p_new_balance - v_item.balance;
  if v_diff = 0 then
    raise exception 'New balance is the same as current — nothing to adjust';
  end if;

  insert into transactions (item_id, type, qty, note, created_by)
    values (p_item_id, case when v_diff > 0 then 'in' else 'out' end, abs(v_diff),
            'Stock count adjustment: ' || p_reason, auth.uid());
end;
$$;
