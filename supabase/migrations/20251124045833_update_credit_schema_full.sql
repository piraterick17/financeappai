/*
  # Update Credit Purchases Schema - Complete

  1. Schema Changes
    - Add `purchase_date` column to credit_purchases (defaults to CURRENT_DATE)
    - Add `supplier_id` column with FK to suppliers table

  2. Function Updates
    - Update `generate_installment_transactions` to:
      - Fix 'import_source' field (was missing)
      - Include supplier_id in generated transactions
      - Include all necessary fields for proper tracking
      - Set is_projected = true for future dates
      - Set is_projected = false for today or past dates

  3. Purpose
    - Track when credit purchase was made (purchase_date)
    - Link credit purchases to suppliers
    - Generate installments with complete metadata
    - Ensure all transactions have proper categorization

  4. Security
    - Maintains existing RLS policies
    - SECURITY DEFINER for function execution
*/

-- Add columns if they don't exist
ALTER TABLE credit_purchases 
ADD COLUMN IF NOT EXISTS purchase_date date DEFAULT CURRENT_DATE;

ALTER TABLE credit_purchases 
ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL;

-- Update the installment transactions generator function
CREATE OR REPLACE FUNCTION generate_installment_transactions(p_credit_purchase_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cp record;
  v_date date;
  v_created int := 0;
BEGIN
  -- Get credit purchase details
  SELECT * INTO v_cp 
  FROM credit_purchases 
  WHERE id = p_credit_purchase_id;

  -- Delete existing projected transactions for this credit purchase
  DELETE FROM transactions 
  WHERE credit_purchase_id = p_credit_purchase_id 
    AND is_projected = true;

  -- Generate installment transactions
  FOR i IN 1..v_cp.installments LOOP
    v_date := v_cp.first_payment_date + ((i - 1) || ' months')::interval;
    
    INSERT INTO transactions (
      user_id,
      account_id,
      type,
      amount,
      description,
      transaction_date,
      category,
      import_source,
      credit_purchase_id,
      is_projected,
      is_recurring,
      supplier_id,
      deleted_at
    ) VALUES (
      v_cp.user_id,
      v_cp.account_id,
      'expense',
      -ABS(v_cp.installment_amount),
      v_cp.description || ' (' || i || '/' || v_cp.installments || ')',
      v_date,
      'Deuda',
      'credit_purchase',
      p_credit_purchase_id,
      v_date > CURRENT_DATE,
      false,
      v_cp.supplier_id,
      NULL
    );
    
    v_created := v_created + 1;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'created', v_created
  );
END;
$$;