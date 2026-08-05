-- Patch 2026-08-05d: prevent items.balance from ever going negative.
-- Server-side balance checks already exist for transfers/loans/requests
-- (send_transfer, approve_request, send_loan_return all raise an exception
-- if balance < qty). But a plain Stock Out insert (Record.jsx) has no such
-- guard — it relies only on the client's possibly-stale balance to warn the
-- user. Two staff recording Stock Out for the same item at once, or
-- undoing a Stock In after some of it has since been used, could silently
-- drive balance negative. This adds a DB-level backstop: any insert or
-- undo that would push balance below zero now fails atomically instead of
-- corrupting the count.

alter table public.items add constraint items_balance_nonneg check (balance >= 0);
