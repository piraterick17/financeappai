/*
  # Update Credit Purchases Schema

  1. New Columns
    - `purchase_date` (date, default current_date)
      - Records the actual date when the purchase was made
      - Defaults to today's date for new purchases

    - `supplier_id` (uuid, nullable)
      - Foreign key reference to suppliers table
      - Allows tracking which supplier/merchant the purchase was from
      - Nullable to support purchases without supplier tracking

  2. Function Updates
    - `generate_installment_transactions`
      - Updated to propagate supplier_id to all installment transactions
      - Ensures installments inherit the supplier from the parent purchase
      - Maintains supplier tracking consistency across installments

  3. Important Notes
    - Existing credit purchases will have NULL supplier_id (can be updated manually)
    - Existing credit purchases will have purchase_date set to current_date (can be updated)
    - All future installment transactions will inherit the supplier from the purchase
    - This enables better tracking of spending by supplier for credit purchases
*/

-- Add purchase_date column to credit_purchases table
ALTER TABLE credit_purchases
ADD COLUMN IF NOT EXISTS purchase_date date DEFAULT CURRENT_DATE;

-- Add supplier_id column to credit_purchases table with foreign key
ALTER TABLE credit_purchases
ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL;

-- Create index on supplier_id for better query performance
CREATE INDEX IF NOT EXISTS idx_credit_purchases_supplier_id ON credit_purchases(supplier_id);

-- Update the generate_installment_transactions function to propagate supplier_id
CREATE OR REPLACE FUNCTION generate_installment_transactions(p_credit_purchase_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_credit_purchase record;
  v_payment_date date;
  v_installment_number int;
  v_transactions_created int := 0;
  v_today date := CURRENT_DATE;
BEGIN
  -- Obtener datos de la compra incluyendo el nuevo supplier_id
  SELECT * INTO v_credit_purchase
  FROM credit_purchases
  WHERE id = p_credit_purchase_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Compra no encontrada');
  END IF;

  -- Limpiar proyecciones previas
  DELETE FROM transactions
  WHERE credit_purchase_id = p_credit_purchase_id
    AND is_projected = true;

  -- Generar cuotas
  FOR v_installment_number IN 1..v_credit_purchase.installments LOOP
    v_payment_date := v_credit_purchase.first_payment_date + ((v_installment_number - 1) || ' months')::interval;

    INSERT INTO transactions (
      user_id,
      account_id,
      type,
      amount,
      description,
      transaction_date,
      category,
      source,
      credit_purchase_id,
      is_projected,
      is_recurring,
      supplier_id,
      deleted_at
    ) VALUES (
      v_credit_purchase.user_id,
      v_credit_purchase.account_id,
      'expense',
      -ABS(v_credit_purchase.installment_amount),
      v_credit_purchase.description || ' (' || v_installment_number || '/' || v_credit_purchase.installments || ')',
      v_payment_date,
      'Deuda',
      'credit_purchase',
      p_credit_purchase_id,
      v_payment_date > v_today,
      false,
      v_credit_purchase.supplier_id,
      NULL
    );

    v_transactions_created := v_transactions_created + 1;
  END LOOP;

  RETURN json_build_object('success', true, 'created', v_transactions_created);
END;
$$;