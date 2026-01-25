/*
  # Add automatic projected transactions realization

  1. New Function
    - `check_and_realize_projected_transactions()`
      - Checks for projected transactions that should be realized (today or earlier)
      - Converts projected transactions to actual transactions
      - Updates account balances accordingly
      - Returns count of realized transactions

  2. Purpose
    - Automatically applies credit card installments when their date arrives
    - Ensures dashboard shows correct balances including today's payments
    - Runs silently on dashboard load without blocking UI

  3. How it works
    - Finds all is_projected = true transactions with transaction_date <= today
    - Sets is_projected = false for each
    - Updates corresponding account balances
    - Returns the count of transactions realized

  4. Security
    - No user_id parameter needed (processes all users' transactions)
    - Safe to run multiple times (idempotent)
    - SECURITY DEFINER to ensure proper permissions
*/

CREATE OR REPLACE FUNCTION check_and_realize_projected_transactions()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction record;
  v_realized_count int := 0;
  v_today date := CURRENT_DATE;
BEGIN
  -- Find all projected transactions that should be realized
  FOR v_transaction IN
    SELECT 
      id,
      account_id,
      amount,
      user_id
    FROM transactions
    WHERE is_projected = true
      AND transaction_date <= v_today
      AND deleted_at IS NULL
  LOOP
    -- Mark transaction as realized (no longer projected)
    UPDATE transactions
    SET is_projected = false
    WHERE id = v_transaction.id;

    -- Update account balance
    UPDATE accounts
    SET balance = balance + v_transaction.amount
    WHERE id = v_transaction.account_id
      AND user_id = v_transaction.user_id;

    v_realized_count := v_realized_count + 1;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'realized_count', v_realized_count,
    'date', v_today
  );
END;
$$;