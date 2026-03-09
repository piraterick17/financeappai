-- =====================================================
-- FIX: Soft-delete 12 duplicate/incorrect March transactions
-- Run in Supabase Dashboard > SQL Editor
-- =====================================================

-- ANNUAL SUBSCRIPTIONS IN WRONG MONTH (6 records)
-- Duolingo: annual starts Sept, should NOT be in March (2 copies)
-- Montessori: annual starts May, should NOT be in March (2 copies)
-- Tiimo: annual starts Nov, should NOT be in March (2 copies)

-- MONTHLY SUBSCRIPTION DUPLICATES (6 records)
-- Each monthly sub has 2 projected copies in March — keep 1, delete the other
-- Root cause: subscriptionProcessor.ts AND generate_fixed_expense_projections RPC
-- both generated projected transactions — double execution

UPDATE transactions
SET deleted_at = NOW()
WHERE id IN (
  -- Duolingo (annual, Sept) — both copies wrong month
  '1765e9a0-cf30-41fd-b02e-df9b8ea85386',
  '107a935b-4b07-4a1d-a9a8-4411e4369d46',
  -- Montessori (annual, May) — both copies wrong month
  '06092fc4-54db-418d-a5f5-9a82d9cf7fea',
  '2b05b2e9-d62b-475f-ad12-ee0396aa8273',
  -- Tiimo (annual, Nov) — both copies wrong month
  'd057ba71-3ecc-4b07-bb51-9b0ebec4719c',
  '1e365ed0-9b7f-4afd-ada7-0cf03c8c583c',
  -- Apple One duplicate (keep 9d9b826e)
  '24cc7ddd-6231-4b85-89f9-a6f07749d731',
  -- Fox One duplicate (keep 58ac0bfa)
  'c905fb80-110a-4949-a609-076d6ec940e2',
  -- Google duplicate (keep 6c4f30f2)
  '9242514c-5439-400c-874e-2b14b2122835',
  -- HBO Max duplicate (keep 756ee36f)
  '8acedec9-e54a-4bbc-ba0d-29c3bc3c5790',
  -- Mercado Libre duplicate (keep d4f35d90)
  '47d0274e-6f92-4f14-9816-430d90589176',
  -- Youtube duplicate (keep 4380ca10)
  '20a7df05-fbba-4490-96a1-b635b13764a6'
)
AND deleted_at IS NULL;

-- Verify: should show 0 for these descriptions in March
SELECT description, COUNT(*) as count
FROM transactions
WHERE transaction_date >= '2026-03-01'
  AND transaction_date <= '2026-03-31'
  AND deleted_at IS NULL
  AND description IN ('Duolingo', 'Montessori', 'Tiimo', 'Apple One', 'Fox One', 'Google', 'HBO Max', 'Mercado Libre', 'Youtube')
GROUP BY description
ORDER BY description;
