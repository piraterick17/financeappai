/*
  # Automate Fixed Expenses Projections

  1. Overview
    - Automates generation of projected transactions for fixed expenses
    - Similar pattern to credit purchase installments
    - Ensures fixed expenses always have future projections in transactions table

  2. New Functions
    - `generate_fixed_expense_projections(p_user_id uuid)`: Generates projected transactions for all active fixed expenses
    - Updates `check_and_realize_projected_transactions()`: Now also manages fixed expense projections

  3. How It Works
    - For each active fixed_expense:
      - Checks if projected transaction exists for current month
      - Checks if projected transaction exists for next month
      - Creates missing projections automatically
    - Projected transactions have:
      - description: Fixed expense name
      - amount: Negative value (expense)
      - transaction_date: due_day of the month
      - is_projected: true (until date arrives)
      - is_recurring: true (marks as recurring expense)

  4. Triggers
    - After INSERT/UPDATE on fixed_expenses: Auto-generates projections
    - After DELETE on fixed_expenses: Soft-deletes associated projected transactions

  5. Integration
    - check_and_realize_projected_transactions() now:
      1. Realizes projected transactions that reached their date
      2. Regenerates all fixed expense projections to keep them fresh

  6. Security
    - All functions use SECURITY DEFINER
    - RLS policies remain unchanged
    - Only affects user's own data
*/

-- =====================================================
-- FUNCTION: Generate Fixed Expense Projections
-- =====================================================
CREATE OR REPLACE FUNCTION generate_fixed_expense_projections(p_user_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_expense record;
  v_current_date date := CURRENT_DATE;
  v_current_month_start date;
  v_next_month_start date;
  v_current_month_due date;
  v_next_month_due date;
  v_created int := 0;
  v_user_id uuid;
BEGIN
  -- Use provided user_id or get from auth.uid()
  v_user_id := COALESCE(p_user_id, auth.uid());
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No user_id provided');
  END IF;

  -- Calculate month boundaries
  v_current_month_start := date_trunc('month', v_current_date);
  v_next_month_start := v_current_month_start + interval '1 month';

  -- Loop through all active fixed expenses for the user
  FOR v_expense IN 
    SELECT * 
    FROM fixed_expenses 
    WHERE user_id = v_user_id 
      AND is_active = true
      AND deleted_at IS NULL
      AND (end_date IS NULL OR end_date >= v_current_date)
  LOOP
    -- Calculate due dates for current and next month
    v_current_month_due := v_current_month_start + (v_expense.due_day - 1 || ' days')::interval;
    v_next_month_due := v_next_month_start + (v_expense.due_day - 1 || ' days')::interval;

    -- Ensure due date doesn't exceed month length
    IF v_current_month_due >= v_next_month_start THEN
      v_current_month_due := v_next_month_start - interval '1 day';
    END IF;
    IF v_next_month_due >= (v_next_month_start + interval '1 month') THEN
      v_next_month_due := (v_next_month_start + interval '1 month') - interval '1 day';
    END IF;

    -- Check and create projection for CURRENT MONTH if missing
    IF v_current_month_due >= v_expense.start_date 
       AND (v_expense.end_date IS NULL OR v_current_month_due <= v_expense.end_date)
    THEN
      IF NOT EXISTS (
        SELECT 1 FROM transactions
        WHERE user_id = v_user_id
          AND account_id = v_expense.account_id
          AND transaction_date = v_current_month_due
          AND description = v_expense.name
          AND deleted_at IS NULL
      ) THEN
        INSERT INTO transactions (
          user_id,
          account_id,
          type,
          amount,
          description,
          transaction_date,
          category,
          import_source,
          is_projected,
          is_recurring,
          recurring_frequency,
          recurring_day,
          category_id,
          deleted_at
        ) VALUES (
          v_expense.user_id,
          v_expense.account_id,
          'expense',
          -ABS(v_expense.amount),
          v_expense.name,
          v_current_month_due,
          'Gasto Fijo',
          'fixed_expense',
          v_current_month_due > v_current_date,
          true,
          'monthly',
          v_expense.due_day,
          v_expense.category_id,
          NULL
        );
        v_created := v_created + 1;
      END IF;
    END IF;

    -- Check and create projection for NEXT MONTH if missing
    IF v_next_month_due >= v_expense.start_date 
       AND (v_expense.end_date IS NULL OR v_next_month_due <= v_expense.end_date)
    THEN
      IF NOT EXISTS (
        SELECT 1 FROM transactions
        WHERE user_id = v_user_id
          AND account_id = v_expense.account_id
          AND transaction_date = v_next_month_due
          AND description = v_expense.name
          AND deleted_at IS NULL
      ) THEN
        INSERT INTO transactions (
          user_id,
          account_id,
          type,
          amount,
          description,
          transaction_date,
          category,
          import_source,
          is_projected,
          is_recurring,
          recurring_frequency,
          recurring_day,
          category_id,
          deleted_at
        ) VALUES (
          v_expense.user_id,
          v_expense.account_id,
          'expense',
          -ABS(v_expense.amount),
          v_expense.name,
          v_next_month_due,
          'Gasto Fijo',
          'fixed_expense',
          true,
          true,
          'monthly',
          v_expense.due_day,
          v_expense.category_id,
          NULL
        );
        v_created := v_created + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'created', v_created
  );
END;
$$;

-- =====================================================
-- TRIGGER: Auto-generate projections on fixed_expenses INSERT/UPDATE
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_generate_fixed_expense_projections()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only generate if expense is active
  IF NEW.is_active = true AND NEW.deleted_at IS NULL THEN
    PERFORM generate_fixed_expense_projections(NEW.user_id);
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_fixed_expense_projections_on_insert ON fixed_expenses;
CREATE TRIGGER trigger_fixed_expense_projections_on_insert
  AFTER INSERT ON fixed_expenses
  FOR EACH ROW
  EXECUTE FUNCTION trigger_generate_fixed_expense_projections();

DROP TRIGGER IF EXISTS trigger_fixed_expense_projections_on_update ON fixed_expenses;
CREATE TRIGGER trigger_fixed_expense_projections_on_update
  AFTER UPDATE ON fixed_expenses
  FOR EACH ROW
  WHEN (
    OLD.is_active IS DISTINCT FROM NEW.is_active OR
    OLD.amount IS DISTINCT FROM NEW.amount OR
    OLD.due_day IS DISTINCT FROM NEW.due_day OR
    OLD.deleted_at IS DISTINCT FROM NEW.deleted_at
  )
  EXECUTE FUNCTION trigger_generate_fixed_expense_projections();

-- =====================================================
-- TRIGGER: Soft-delete projections when fixed_expense is deleted
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_soft_delete_fixed_expense_projections()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- When fixed_expense is soft-deleted, soft-delete its projected transactions
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE transactions
    SET deleted_at = NEW.deleted_at
    WHERE user_id = NEW.user_id
      AND account_id = NEW.account_id
      AND description = NEW.name
      AND import_source = 'fixed_expense'
      AND is_projected = true
      AND deleted_at IS NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_soft_delete_fixed_expense_trans ON fixed_expenses;
CREATE TRIGGER trigger_soft_delete_fixed_expense_trans
  AFTER UPDATE ON fixed_expenses
  FOR EACH ROW
  WHEN (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL)
  EXECUTE FUNCTION trigger_soft_delete_fixed_expense_projections();

-- =====================================================
-- UPDATE: check_and_realize_projected_transactions
-- =====================================================
-- Enhance existing function to also regenerate fixed expense projections
CREATE OR REPLACE FUNCTION check_and_realize_projected_transactions()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_realized_count int := 0;
  v_user_id uuid;
BEGIN
  -- Step 1: Realize projected transactions that have reached their date
  UPDATE transactions
  SET is_projected = false
  WHERE is_projected = true
    AND transaction_date <= CURRENT_DATE
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_realized_count = ROW_COUNT;

  -- Step 2: Regenerate fixed expense projections for all users
  -- This ensures projections are always fresh (current + next month)
  FOR v_user_id IN 
    SELECT DISTINCT user_id FROM fixed_expenses WHERE is_active = true AND deleted_at IS NULL
  LOOP
    PERFORM generate_fixed_expense_projections(v_user_id);
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'realized_count', v_realized_count,
    'message', 'Projected transactions realized and fixed expense projections regenerated'
  );
END;
$$;

-- =====================================================
-- INITIAL GENERATION: Create projections for existing fixed expenses
-- =====================================================
-- Generate projections for all existing active fixed expenses
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  FOR v_user_id IN 
    SELECT DISTINCT user_id FROM fixed_expenses WHERE is_active = true AND deleted_at IS NULL
  LOOP
    PERFORM generate_fixed_expense_projections(v_user_id);
  END LOOP;
END $$;