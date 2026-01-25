/*
  # Configuración de Periodo de Corte para Tarjetas de Crédito

  1. Resumen
    - Agrega campos para configurar el periodo de facturación personalizado
    - Crea función para calcular automáticamente el monto a pagar
    - El monto a pagar se calcula sumando gastos dentro del periodo de corte

  2. Nuevos Campos
    - `billing_period_start_day` - Día de inicio del periodo (1-31)
    - `billing_period_end_day` - Día de fin del periodo (1-31)
    - `last_billing_calculation` - Timestamp del último cálculo

  3. Función
    - `calculate_credit_card_amount_due(account_id)` - Calcula el monto a pagar
    - Suma todas las transacciones tipo 'expense' dentro del periodo
    - Excluye transferencias y transacciones eliminadas

  4. Notas
    - El periodo puede cruzar meses (ej: día 25 al día 5)
    - Se pueden ejecutar cálculos manuales o automatizados
    - Los días se ajustan automáticamente según el mes
*/

-- Agregar campos de configuración de periodo
ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS billing_period_start_day INTEGER,
ADD COLUMN IF NOT EXISTS billing_period_end_day INTEGER,
ADD COLUMN IF NOT EXISTS last_billing_calculation TIMESTAMPTZ;

-- Comentarios explicativos
COMMENT ON COLUMN accounts.billing_period_start_day IS 'Día de inicio del periodo de facturación (1-31). Por defecto usa el día después del último corte.';
COMMENT ON COLUMN accounts.billing_period_end_day IS 'Día de fin del periodo de facturación (1-31). Por defecto usa el día de corte.';
COMMENT ON COLUMN accounts.last_billing_calculation IS 'Fecha y hora del último cálculo de monto a pagar';

-- Función para calcular el monto a pagar de una tarjeta de crédito
CREATE OR REPLACE FUNCTION calculate_credit_card_amount_due(
  p_account_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  v_start_date DATE;
  v_end_date DATE;
  v_total_amount NUMERIC := 0;
  v_account_record RECORD;
BEGIN
  -- Obtener información de la cuenta
  SELECT * INTO v_account_record
  FROM accounts
  WHERE id = p_account_id AND type = 'credit' AND deleted_at IS NULL;

  -- Verificar que la cuenta existe y es de tipo crédito
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found or is not a credit card';
  END IF;

  -- Si se proporcionan fechas específicas, usarlas
  IF p_start_date IS NOT NULL AND p_end_date IS NOT NULL THEN
    v_start_date := p_start_date;
    v_end_date := p_end_date;
  ELSE
    -- Calcular fechas del periodo actual basándose en la configuración
    IF v_account_record.billing_period_start_day IS NOT NULL 
       AND v_account_record.billing_period_end_day IS NOT NULL THEN
      
      -- Usar el periodo configurado
      v_end_date := CURRENT_DATE;
      
      -- Calcular fecha de inicio (puede ser del mes anterior)
      IF v_account_record.billing_period_start_day > v_account_record.billing_period_end_day THEN
        -- El periodo cruza el mes (ej: 25 al 5)
        IF EXTRACT(DAY FROM CURRENT_DATE) <= v_account_record.billing_period_end_day THEN
          -- Estamos en el mes de cierre
          v_start_date := DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') 
                          + (v_account_record.billing_period_start_day - 1) * INTERVAL '1 day';
          v_end_date := DATE_TRUNC('month', CURRENT_DATE) 
                        + (v_account_record.billing_period_end_day - 1) * INTERVAL '1 day';
        ELSE
          -- Estamos en el mes de inicio
          v_start_date := DATE_TRUNC('month', CURRENT_DATE) 
                          + (v_account_record.billing_period_start_day - 1) * INTERVAL '1 day';
          v_end_date := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month') 
                        + (v_account_record.billing_period_end_day - 1) * INTERVAL '1 day';
        END IF;
      ELSE
        -- El periodo está dentro del mismo mes
        v_start_date := DATE_TRUNC('month', CURRENT_DATE) 
                        + (v_account_record.billing_period_start_day - 1) * INTERVAL '1 day';
        v_end_date := DATE_TRUNC('month', CURRENT_DATE) 
                      + (v_account_record.billing_period_end_day - 1) * INTERVAL '1 day';
      END IF;
    ELSE
      -- Fallback: usar el mes actual completo
      v_start_date := DATE_TRUNC('month', CURRENT_DATE);
      v_end_date := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month') - INTERVAL '1 day';
    END IF;
  END IF;

  -- Calcular el total de gastos en el periodo
  SELECT COALESCE(SUM(ABS(amount)), 0)
  INTO v_total_amount
  FROM transactions
  WHERE account_id = p_account_id
    AND type = 'expense'
    AND is_transfer = FALSE
    AND deleted_at IS NULL
    AND transaction_date >= v_start_date
    AND transaction_date <= v_end_date;

  -- Actualizar el timestamp del último cálculo
  UPDATE accounts
  SET last_billing_calculation = NOW()
  WHERE id = p_account_id;

  RETURN v_total_amount;
END;
$$;

-- Función auxiliar para actualizar el monto a pagar de todas las tarjetas de crédito
CREATE OR REPLACE FUNCTION update_all_credit_cards_amount_due()
RETURNS TABLE(account_id UUID, account_name TEXT, calculated_amount NUMERIC)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH updated AS (
    SELECT 
      a.id,
      a.name,
      calculate_credit_card_amount_due(a.id) as new_amount
    FROM accounts a
    WHERE a.type = 'credit' 
      AND a.deleted_at IS NULL
      AND a.is_active = TRUE
  )
  UPDATE accounts a
  SET amount_due = u.new_amount
  FROM updated u
  WHERE a.id = u.id
  RETURNING a.id, a.name, a.amount_due;
END;
$$;

-- Comentarios en las funciones
COMMENT ON FUNCTION calculate_credit_card_amount_due IS 'Calcula el monto a pagar de una tarjeta de crédito sumando los gastos del periodo de facturación';
COMMENT ON FUNCTION update_all_credit_cards_amount_due IS 'Actualiza el monto a pagar de todas las tarjetas de crédito activas';
