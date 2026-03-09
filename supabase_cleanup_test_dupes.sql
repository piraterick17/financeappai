-- =============================================
-- Cleanup: Delete duplicate test transactions
-- Created by AI Copilot testing on 2026-03-08
-- =============================================
-- 
-- BEFORE RUNNING: Review which transactions to delete.
-- Run this SELECT first to see what will be affected:

-- 1. See duplicated "Ropa para Helena" (should only be one)
SELECT id, description, amount, transaction_date, created_at
FROM transactions
WHERE description ILIKE '%Ropa para Helena%'
  AND deleted_at IS NULL
ORDER BY created_at DESC;

-- 2. See duplicated "Walmart" (one at 8 mar, one at 7 mar)
SELECT id, description, amount, transaction_date, created_at 
FROM transactions
WHERE description ILIKE '%Walmart%'
  AND transaction_date >= '2026-03-07'
  AND deleted_at IS NULL
ORDER BY created_at DESC;

-- 3. See test "Gasolina" transaction (from update flow test)
SELECT id, description, amount, transaction_date, created_at
FROM transactions
WHERE description ILIKE '%Gasolina%'
  AND transaction_date >= '2026-03-08'
  AND deleted_at IS NULL
ORDER BY created_at DESC;

-- =============================================
-- CLEANUP: Soft-delete the duplicates
-- Keep the OLDEST of each set (first created)
-- =============================================

-- Delete extra "Ropa para Helena" copies (keep oldest)
UPDATE transactions
SET deleted_at = NOW()
WHERE description ILIKE '%Ropa para Helena%'
  AND deleted_at IS NULL
  AND id NOT IN (
    SELECT id FROM transactions
    WHERE description ILIKE '%Ropa para Helena%'
      AND deleted_at IS NULL
    ORDER BY created_at ASC
    LIMIT 1
  );

-- Delete the Walmart from 8 mar (the one that should have been updated, not duplicated)
UPDATE transactions
SET deleted_at = NOW()
WHERE description ILIKE '%Walmart%'
  AND transaction_date = '2026-03-08'
  AND deleted_at IS NULL
  AND amount = -500;

-- Optionally delete ALL test transactions from today if you want clean data:
-- UPDATE transactions SET deleted_at = NOW()
-- WHERE transaction_date >= '2026-03-08' AND deleted_at IS NULL
-- AND description IN ('Ropa para Helena', 'Walmart', 'Gasolina');
