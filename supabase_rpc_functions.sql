-- =====================================================
-- FINANZAS APP — 5 FUNCIONES RPC FALTANTES
-- Ejecutar en Supabase Dashboard > SQL Editor
-- =====================================================

-- 1. REGISTER_TRANSFER
-- Registra una transferencia entre dos cuentas
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
  -- Débito de cuenta origen
  INSERT INTO transactions (user_id, account_id, type, amount, description, transaction_date, is_transfer, transfer_group_id, is_projected)
  VALUES (p_user_id, p_source_account_id, 'expense', -ABS(p_amount), p_description || ' (Salida)', p_date::date, true, v_transfer_group, false);

  -- Crédito a cuenta destino
  INSERT INTO transactions (user_id, account_id, type, amount, description, transaction_date, is_transfer, transfer_group_id, is_projected)
  VALUES (p_user_id, p_destination_account_id, 'income', ABS(p_amount), p_description || ' (Entrada)', p_date::date, true, v_transfer_group, false);

  -- Actualizar balances
  UPDATE accounts SET balance = balance - ABS(p_amount) WHERE id = p_source_account_id;
  UPDATE accounts SET balance = balance + ABS(p_amount) WHERE id = p_destination_account_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. GENERATE_INSTALLMENT_TRANSACTIONS
-- Genera transacciones de cuotas para una compra a crédito (MSI)
CREATE OR REPLACE FUNCTION generate_installment_transactions(
  p_credit_purchase_id UUID
) RETURNS JSON AS $$
DECLARE
  v_purchase RECORD;
  v_current_date DATE;
  v_i INTEGER;
  v_created INTEGER := 0;
BEGIN
  SELECT * INTO v_purchase FROM credit_purchases WHERE id = p_credit_purchase_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'created', 0, 'error', 'Credit purchase not found');
  END IF;

  FOR v_i IN 1..v_purchase.installments LOOP
    v_current_date := (v_purchase.first_payment_date::date + ((v_i - 1) * INTERVAL '1 month'))::date;
    
    -- Verificar si ya existe la transacción para esta cuota
    IF NOT EXISTS (
      SELECT 1 FROM transactions 
      WHERE credit_purchase_id = p_credit_purchase_id 
      AND description LIKE '%(' || v_i || '/' || v_purchase.installments || ')%'
      AND deleted_at IS NULL
    ) THEN
      INSERT INTO transactions (
        user_id, account_id, category_id, type, amount, description, 
        transaction_date, is_recurring, is_projected, credit_purchase_id, category
      ) VALUES (
        v_purchase.user_id,
        v_purchase.account_id,
        v_purchase.category_id,
        'expense',
        -ABS(v_purchase.installment_amount),
        v_purchase.description || ' (' || v_i || '/' || v_purchase.installments || ')',
        v_current_date,
        true,
        v_current_date > CURRENT_DATE,
        p_credit_purchase_id,
        (SELECT name FROM categories WHERE id = v_purchase.category_id)
      );
      v_created := v_created + 1;
    END IF;
  END LOOP;

  -- Actualizar cuotas restantes
  UPDATE credit_purchases 
  SET remaining_installments = (
    SELECT installments - COUNT(*) 
    FROM transactions 
    WHERE credit_purchase_id = p_credit_purchase_id 
    AND deleted_at IS NULL 
    AND is_projected = false
  )
  WHERE id = p_credit_purchase_id;

  RETURN json_build_object('success', true, 'created', v_created);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. CALCULATE_CREDIT_CARD_AMOUNT_DUE
-- Calcula el monto a pagar de una tarjeta de crédito en su periodo
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
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Usar periodo de facturación si está configurado
  IF v_account.billing_period_start_day IS NOT NULL AND v_account.billing_period_end_day IS NOT NULL THEN
    IF v_account.billing_period_start_day > v_account.billing_period_end_day THEN
      -- Periodo cruza mes (ej: 25 al 5)
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
    -- Usar día de corte
    IF EXTRACT(DAY FROM v_today) >= v_account.cut_off_day THEN
      v_start_date := DATE_TRUNC('month', v_today) + (v_account.cut_off_day - 1) * INTERVAL '1 day';
      v_end_date := (DATE_TRUNC('month', v_today) + INTERVAL '1 month') + (v_account.cut_off_day - 2) * INTERVAL '1 day';
    ELSE
      v_start_date := (DATE_TRUNC('month', v_today) - INTERVAL '1 month') + (v_account.cut_off_day - 1) * INTERVAL '1 day';
      v_end_date := DATE_TRUNC('month', v_today) + (v_account.cut_off_day - 2) * INTERVAL '1 day';
    END IF;
  ELSE
    -- Default: mes completo
    v_start_date := DATE_TRUNC('month', v_today)::date;
    v_end_date := (DATE_TRUNC('month', v_today) + INTERVAL '1 month' - INTERVAL '1 day')::date;
  END IF;

  -- Sumar gastos del periodo
  SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_total
  FROM transactions
  WHERE account_id = p_account_id
    AND type = 'expense'
    AND is_transfer = false
    AND deleted_at IS NULL
    AND transaction_date >= v_start_date
    AND transaction_date <= v_end_date;

  -- Actualizar monto en la cuenta
  UPDATE accounts 
  SET amount_due = v_total, 
      last_billing_calculation = NOW()
  WHERE id = p_account_id;

  RETURN v_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. GENERATE_FIXED_EXPENSE_PROJECTIONS
-- Genera transacciones proyectadas para gastos fijos activos
CREATE OR REPLACE FUNCTION generate_fixed_expense_projections(
  p_user_id UUID
) RETURNS VOID AS $$
DECLARE
  v_expense RECORD;
  v_target_date DATE;
  v_current_month DATE := DATE_TRUNC('month', CURRENT_DATE)::date;
  v_days_in_month INTEGER;
  v_day INTEGER;
BEGIN
  FOR v_expense IN 
    SELECT fe.*, c.name as category_name 
    FROM fixed_expenses fe
    LEFT JOIN categories c ON fe.category_id = c.id
    WHERE fe.user_id = p_user_id 
    AND fe.is_active = true 
    AND fe.deleted_at IS NULL
  LOOP
    -- Verificar frecuencia
    IF v_expense.frequency IN ('annual', 'yearly') THEN
      IF EXTRACT(MONTH FROM v_expense.start_date::date) != EXTRACT(MONTH FROM CURRENT_DATE) THEN
        CONTINUE;
      END IF;
    END IF;

    -- Calcular fecha para este mes
    v_days_in_month := EXTRACT(DAY FROM (v_current_month + INTERVAL '1 month' - INTERVAL '1 day'))::integer;
    v_day := LEAST(v_expense.due_day, v_days_in_month);
    v_target_date := v_current_month + (v_day - 1) * INTERVAL '1 day';

    -- Verificar si ya existe
    IF NOT EXISTS (
      SELECT 1 FROM transactions 
      WHERE user_id = p_user_id 
      AND account_id = v_expense.account_id
      AND ABS(amount) = ABS(v_expense.amount)
      AND description = v_expense.name
      AND transaction_date >= v_current_month
      AND transaction_date < v_current_month + INTERVAL '1 month'
      AND deleted_at IS NULL
    ) THEN
      IF v_target_date >= CURRENT_DATE THEN
        INSERT INTO transactions (
          user_id, account_id, category_id, type, amount, description,
          transaction_date, is_recurring, recurrence_period, is_projected, category
        ) VALUES (
          p_user_id,
          v_expense.account_id,
          v_expense.category_id,
          'expense',
          -ABS(v_expense.amount),
          v_expense.name,
          v_target_date,
          true,
          v_expense.frequency,
          true,
          v_expense.category_name
        );
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. GET_MONTHLY_BUDGET_STATUS
-- Obtiene estado de presupuesto por categoría para un mes dado
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
  v_month_start := (p_month || '-01')::date;
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
    AND t.type = 'expense'
    AND t.is_transfer = false
    AND t.deleted_at IS NULL
    AND t.transaction_date >= v_month_start
    AND t.transaction_date <= v_month_end
    AND t.user_id = v_user_id
  WHERE cb.user_id = v_user_id
  GROUP BY cb.category_id, c.name, c.color, cb.amount;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
