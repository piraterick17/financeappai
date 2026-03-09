-- =====================================================
-- FIX: Drop ALL function overloads and recreate clean
-- Supabase Dashboard > SQL Editor > Run
-- =====================================================

-- Step 1: Find and drop ALL overloads
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT n.nspname, p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) as args
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname IN ('register_transfer', 'calculate_credit_card_amount_due', 'get_monthly_budget_status')
    AND n.nspname = 'public'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', r.nspname, r.proname, r.args);
    RAISE NOTICE 'Dropped: %.%(%) ', r.nspname, r.proname, r.args;
  END LOOP;
END $$;


-- Step 2: Recreate clean functions

-- REGISTER_TRANSFER
CREATE OR REPLACE FUNCTION register_transfer(
  p_user_id UUID,
  p_source_account_id UUID,
  p_destination_account_id UUID,
  p_amount NUMERIC,
  p_date TEXT,
  p_description TEXT DEFAULT 'Transferencia'
) RETURNS VOID AS $$
DECLARE
  v_transfer_group UUID := gen_random_uuid();
BEGIN
  INSERT INTO transactions (user_id, account_id, type, amount, description, transaction_date, is_transfer, transfer_group_id, is_projected)
  VALUES (p_user_id, p_source_account_id, 'expense', -ABS(p_amount), p_description || ' (Salida)', p_date::date, true, v_transfer_group, false);

  INSERT INTO transactions (user_id, account_id, type, amount, description, transaction_date, is_transfer, transfer_group_id, is_projected)
  VALUES (p_user_id, p_destination_account_id, 'income', ABS(p_amount), p_description || ' (Entrada)', p_date::date, true, v_transfer_group, false);

  UPDATE accounts SET balance = balance - ABS(p_amount) WHERE id = p_source_account_id;
  UPDATE accounts SET balance = balance + ABS(p_amount) WHERE id = p_destination_account_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- CALCULATE_CREDIT_CARD_AMOUNT_DUE
CREATE OR REPLACE FUNCTION calculate_credit_card_amount_due(
  p_account_id UUID
) RETURNS NUMERIC AS $$
DECLARE
  v_account RECORD;
  v_start_date DATE;
  v_end_date DATE;
  v_total NUMERIC := 0;
  v_today DATE := CURRENT_DATE;
BEGIN
  SELECT * INTO v_account FROM accounts WHERE id = p_account_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  IF v_account.billing_period_start_day IS NOT NULL AND v_account.billing_period_end_day IS NOT NULL THEN
    IF v_account.billing_period_start_day > v_account.billing_period_end_day THEN
      IF EXTRACT(DAY FROM v_today) >= v_account.billing_period_start_day THEN
        v_start_date := DATE_TRUNC('month', v_today) + (v_account.billing_period_start_day - 1) * INTERVAL '1 day';
        v_end_date := (DATE_TRUNC('month', v_today) + INTERVAL '1 month') + (v_account.billing_period_end_day - 1) * INTERVAL '1 day';
      ELSE
        v_start_date := (DATE_TRUNC('month', v_today) - INTERVAL '1 month') + (v_account.billing_period_start_day - 1) * INTERVAL '1 day';
        v_end_date := DATE_TRUNC('month', v_today) + (v_account.billing_period_end_day - 1) * INTERVAL '1 day';
      END IF;
    ELSE
      v_start_date := DATE_TRUNC('month', v_today) + (v_account.billing_period_start_day - 1) * INTERVAL '1 day';
      v_end_date := DATE_TRUNC('month', v_today) + (v_account.billing_period_end_day - 1) * INTERVAL '1 day';
    END IF;
  ELSIF v_account.cut_off_day IS NOT NULL THEN
    IF EXTRACT(DAY FROM v_today) >= v_account.cut_off_day THEN
      v_start_date := DATE_TRUNC('month', v_today) + (v_account.cut_off_day - 1) * INTERVAL '1 day';
      v_end_date := (DATE_TRUNC('month', v_today) + INTERVAL '1 month') + (v_account.cut_off_day - 2) * INTERVAL '1 day';
    ELSE
      v_start_date := (DATE_TRUNC('month', v_today) - INTERVAL '1 month') + (v_account.cut_off_day - 1) * INTERVAL '1 day';
      v_end_date := DATE_TRUNC('month', v_today) + (v_account.cut_off_day - 2) * INTERVAL '1 day';
    END IF;
  ELSE
    v_start_date := DATE_TRUNC('month', v_today)::date;
    v_end_date := (DATE_TRUNC('month', v_today) + INTERVAL '1 month' - INTERVAL '1 day')::date;
  END IF;

  SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_total
  FROM transactions
  WHERE account_id = p_account_id AND type = 'expense' AND is_transfer = false AND deleted_at IS NULL
    AND transaction_date >= v_start_date AND transaction_date <= v_end_date;

  UPDATE accounts SET amount_due = v_total, last_billing_calculation = NOW() WHERE id = p_account_id;
  RETURN v_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- GET_MONTHLY_BUDGET_STATUS
-- Note: p_month receives full date like '2026-03-01' from frontend
CREATE OR REPLACE FUNCTION get_monthly_budget_status(
  p_month TEXT
) RETURNS TABLE (
  category_id UUID,
  category_name TEXT,
  category_color TEXT,
  limit_amount NUMERIC,
  spent_amount NUMERIC,
  percentage NUMERIC
) AS $$
DECLARE
  v_month_start DATE;
  v_month_end DATE;
  v_user_id UUID;
BEGIN
  -- Handle both '2026-03' and '2026-03-01' formats
  IF LENGTH(p_month) > 7 THEN
    v_month_start := DATE_TRUNC('month', p_month::date)::date;
  ELSE
    v_month_start := (p_month || '-01')::date;
  END IF;
  v_month_end := (v_month_start + INTERVAL '1 month' - INTERVAL '1 day')::date;
  v_user_id := auth.uid();

  RETURN QUERY
  SELECT 
    cb.category_id,
    c.name::TEXT as category_name,
    c.color::TEXT as category_color,
    cb.amount as limit_amount,
    COALESCE(ABS(SUM(t.amount)), 0) as spent_amount,
    CASE 
      WHEN cb.amount > 0 THEN ROUND((COALESCE(ABS(SUM(t.amount)), 0) / cb.amount) * 100, 1)
      ELSE 0
    END as percentage
  FROM category_budgets cb
  JOIN categories c ON cb.category_id = c.id
  LEFT JOIN transactions t ON t.category_id = cb.category_id 
    AND t.type = 'expense' AND t.is_transfer = false AND t.deleted_at IS NULL
    AND t.transaction_date >= v_month_start AND t.transaction_date <= v_month_end
    AND t.user_id = v_user_id
  WHERE cb.user_id = v_user_id
  GROUP BY cb.category_id, c.name, c.color, cb.amount;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
