/*
  # Sistema de Generación Automática de Cuotas

  ## Descripción
  Este sistema genera automáticamente transacciones proyectadas para cada cuota de una
  compra a crédito, permitiendo visualizar el flujo de caja futuro sin afectar el saldo
  actual hasta que llegue la fecha de cada pago.

  ## Componentes Implementados

  ### 1. Columna: is_projected en transactions
  Nueva columna para identificar transacciones proyectadas (futuras) vs reales.
  - `is_projected = true`: Transacción futura, aparece en forecast pero NO afecta saldo actual
  - `is_projected = false`: Transacción real que afecta el saldo actual

  ### 2. Columna: credit_purchase_id en transactions
  Relación con la tabla credit_purchases para tracking de cuotas generadas.

  ### 3. Función RPC: generate_installment_transactions()
  Genera automáticamente todas las transacciones de cuotas para una compra a crédito.

  **Parámetros**:
  - `p_credit_purchase_id`: UUID de la compra a crédito

  **Retorna**:
  - JSON con resultado de la operación

  **Lógica**:
  1. Obtiene datos de la compra a crédito
  2. Calcula fecha de cada cuota (mensual desde first_payment_date)
  3. Genera transacciones proyectadas para cada cuota
  4. Las transacciones pasadas se marcan como no proyectadas (reales)
  5. Las transacciones futuras se marcan como proyectadas

  ### 4. Función: check_and_realize_projected_transactions()
  Convierte automáticamente transacciones proyectadas en reales cuando llega su fecha.

  ### 5. Trigger: update_projected_transactions_daily
  Ejecuta diariamente la función de conversión de transacciones proyectadas.

  ## Casos de Uso

  ### Caso 1: Crear Compra a Crédito de 12 MSI
  ```sql
  -- 1. Insertar compra a crédito
  INSERT INTO credit_purchases (
    user_id, account_id, description, 
    total_amount, installments, installment_amount,
    first_payment_date, remaining_installments
  ) VALUES (
    'user-uuid', 'account-uuid', 'iPhone 15',
    24000, 12, 2000,
    '2024-02-01', 12
  ) RETURNING id;

  -- 2. Generar cuotas automáticamente
  SELECT generate_installment_transactions('credit-purchase-uuid');

  -- Resultado: 12 transacciones creadas
  -- - Cuotas pasadas: is_projected = false (afectan saldo actual)
  -- - Cuotas futuras: is_projected = true (solo forecast)
  ```

  ### Caso 2: Visualizar en Forecast
  ```sql
  -- Obtener todas las transacciones (reales + proyectadas)
  SELECT * FROM transactions 
  WHERE user_id = 'user-uuid' 
    AND account_id = 'account-uuid'
    AND deleted_at IS NULL
  ORDER BY transaction_date;

  -- Resultado incluye:
  -- - Transacciones manuales (is_projected = false)
  -- - Cuotas pasadas (is_projected = false)
  -- - Cuotas futuras (is_projected = true)
  ```

  ### Caso 3: Conversión Automática al Llegar la Fecha
  ```sql
  -- Cada día a medianoche:
  SELECT check_and_realize_projected_transactions();

  -- Resultado:
  -- - Transacciones proyectadas con fecha <= HOY
  -- - Se convierten a is_projected = false
  -- - Ahora afectan el saldo actual
  ```

  ## Beneficios

  ✅ **Planificación Financiera**: Ver cuotas futuras en el forecast
  ✅ **Integridad de Datos**: Saldo actual correcto (solo cuenta transacciones reales)
  ✅ **Automatización**: Conversión automática cuando llega la fecha
  ✅ **Tracking**: Relacionar transacciones con su compra a crédito origen
  ✅ **Flexibilidad**: Editar o eliminar cuotas específicas si es necesario

  ## Notas Importantes

  - Las transacciones proyectadas NO afectan el saldo actual de la cuenta
  - El trigger de balance actualizado ignora transacciones proyectadas
  - Las cuotas se generan mensualmente desde first_payment_date
  - Las transacciones generadas tienen source = 'credit_purchase'
  - La conversión de proyectado a real es automática
*/

-- =====================================================
-- 1. AGREGAR COLUMNAS NECESARIAS A TRANSACTIONS
-- =====================================================

-- Columna para identificar transacciones proyectadas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'is_projected'
  ) THEN
    ALTER TABLE transactions ADD COLUMN is_projected boolean DEFAULT false NOT NULL;
    CREATE INDEX idx_transactions_is_projected ON transactions(is_projected) WHERE is_projected = true;
  END IF;
END $$;

-- Columna para relacionar con credit_purchases
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'credit_purchase_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN credit_purchase_id uuid REFERENCES credit_purchases(id) ON DELETE SET NULL;
    CREATE INDEX idx_transactions_credit_purchase_id ON transactions(credit_purchase_id);
  END IF;
END $$;

-- =====================================================
-- 2. ACTUALIZAR TRIGGER DE BALANCE PARA IGNORAR PROYECTADAS
-- =====================================================

-- Modificar la función para ignorar transacciones proyectadas
CREATE OR REPLACE FUNCTION update_account_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  old_amount numeric := 0;
  new_amount numeric := 0;
  balance_change numeric := 0;
BEGIN
  -- ========================================
  -- CASO 1: INSERT (Nueva transacción)
  -- ========================================
  IF TG_OP = 'INSERT' THEN
    -- Solo procesar si NO está proyectada, NO está eliminada y tiene cuenta asociada
    IF NEW.is_projected = false AND NEW.deleted_at IS NULL AND NEW.account_id IS NOT NULL THEN
      IF NEW.type = 'income' THEN
        UPDATE accounts 
        SET balance = balance + NEW.amount,
            updated_at = now()
        WHERE id = NEW.account_id;
      ELSIF NEW.type = 'expense' THEN
        UPDATE accounts 
        SET balance = balance - NEW.amount,
            updated_at = now()
        WHERE id = NEW.account_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- ========================================
  -- CASO 2: UPDATE (Modificar transacción)
  -- ========================================
  IF TG_OP = 'UPDATE' THEN
    
    -- Sub-caso 2.1: Conversión de proyectada a real (cuando llega la fecha)
    IF OLD.is_projected = true AND NEW.is_projected = false THEN
      -- Aplicar el efecto de la transacción ahora que es real
      IF NEW.deleted_at IS NULL AND NEW.account_id IS NOT NULL THEN
        IF NEW.type = 'income' THEN
          UPDATE accounts 
          SET balance = balance + NEW.amount,
              updated_at = now()
          WHERE id = NEW.account_id;
        ELSIF NEW.type = 'expense' THEN
          UPDATE accounts 
          SET balance = balance - NEW.amount,
              updated_at = now()
          WHERE id = NEW.account_id;
        END IF;
      END IF;
      RETURN NEW;
    END IF;

    -- Sub-caso 2.2: Conversión de real a proyectada (reversa)
    IF OLD.is_projected = false AND NEW.is_projected = true THEN
      -- Revertir el efecto de la transacción que era real
      IF OLD.deleted_at IS NULL AND OLD.account_id IS NOT NULL THEN
        IF OLD.type = 'income' THEN
          UPDATE accounts 
          SET balance = balance - OLD.amount,
              updated_at = now()
          WHERE id = OLD.account_id;
        ELSIF OLD.type = 'expense' THEN
          UPDATE accounts 
          SET balance = balance + OLD.amount,
              updated_at = now()
          WHERE id = OLD.account_id;
        END IF;
      END IF;
      RETURN NEW;
    END IF;
    
    -- Sub-caso 2.3: Soft Delete
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL AND OLD.is_projected = false THEN
      IF OLD.account_id IS NOT NULL THEN
        IF OLD.type = 'income' THEN
          UPDATE accounts 
          SET balance = balance - OLD.amount,
              updated_at = now()
          WHERE id = OLD.account_id;
        ELSIF OLD.type = 'expense' THEN
          UPDATE accounts 
          SET balance = balance + OLD.amount,
              updated_at = now()
          WHERE id = OLD.account_id;
        END IF;
      END IF;
      RETURN NEW;
    END IF;

    -- Sub-caso 2.4: Restaurar (deleted_at → NULL)
    IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL AND NEW.is_projected = false THEN
      IF NEW.account_id IS NOT NULL THEN
        IF NEW.type = 'income' THEN
          UPDATE accounts 
          SET balance = balance + NEW.amount,
              updated_at = now()
          WHERE id = NEW.account_id;
        ELSIF NEW.type = 'expense' THEN
          UPDATE accounts 
          SET balance = balance - NEW.amount,
              updated_at = now()
          WHERE id = NEW.account_id;
        END IF;
      END IF;
      RETURN NEW;
    END IF;

    -- Sub-caso 2.5: Modificaciones a transacciones REALES (no proyectadas)
    IF OLD.is_projected = false AND NEW.is_projected = false AND OLD.deleted_at IS NULL AND NEW.deleted_at IS NULL THEN
      
      -- Cambio de cuenta
      IF OLD.account_id != NEW.account_id THEN
        IF OLD.account_id IS NOT NULL THEN
          IF OLD.type = 'income' THEN
            UPDATE accounts SET balance = balance - OLD.amount, updated_at = now() WHERE id = OLD.account_id;
          ELSIF OLD.type = 'expense' THEN
            UPDATE accounts SET balance = balance + OLD.amount, updated_at = now() WHERE id = OLD.account_id;
          END IF;
        END IF;
        
        IF NEW.account_id IS NOT NULL THEN
          IF NEW.type = 'income' THEN
            UPDATE accounts SET balance = balance + NEW.amount, updated_at = now() WHERE id = NEW.account_id;
          ELSIF NEW.type = 'expense' THEN
            UPDATE accounts SET balance = balance - NEW.amount, updated_at = now() WHERE id = NEW.account_id;
          END IF;
        END IF;
        
        RETURN NEW;
      END IF;

      -- Cambio de tipo
      IF OLD.type != NEW.type AND OLD.account_id = NEW.account_id THEN
        IF OLD.account_id IS NOT NULL THEN
          IF OLD.type = 'income' THEN
            balance_change := -OLD.amount;
          ELSE
            balance_change := OLD.amount;
          END IF;
          
          IF NEW.type = 'income' THEN
            balance_change := balance_change + NEW.amount;
          ELSE
            balance_change := balance_change - NEW.amount;
          END IF;
          
          UPDATE accounts SET balance = balance + balance_change, updated_at = now() WHERE id = OLD.account_id;
        END IF;
        
        RETURN NEW;
      END IF;

      -- Cambio de monto
      IF OLD.amount != NEW.amount AND OLD.account_id = NEW.account_id AND OLD.type = NEW.type THEN
        IF OLD.account_id IS NOT NULL THEN
          balance_change := NEW.amount - OLD.amount;
          
          IF NEW.type = 'income' THEN
            UPDATE accounts SET balance = balance + balance_change, updated_at = now() WHERE id = OLD.account_id;
          ELSIF NEW.type = 'expense' THEN
            UPDATE accounts SET balance = balance - balance_change, updated_at = now() WHERE id = OLD.account_id;
          END IF;
        END IF;
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  -- ========================================
  -- CASO 3: DELETE (Eliminación física)
  -- ========================================
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_projected = false AND OLD.deleted_at IS NULL AND OLD.account_id IS NOT NULL THEN
      IF OLD.type = 'income' THEN
        UPDATE accounts SET balance = balance - OLD.amount, updated_at = now() WHERE id = OLD.account_id;
      ELSIF OLD.type = 'expense' THEN
        UPDATE accounts SET balance = balance + OLD.amount, updated_at = now() WHERE id = OLD.account_id;
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

-- =====================================================
-- 3. FUNCIÓN PARA GENERAR TRANSACCIONES DE CUOTAS
-- =====================================================

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
  -- Obtener datos de la compra a crédito
  SELECT * INTO v_credit_purchase
  FROM credit_purchases
  WHERE id = p_credit_purchase_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Compra a crédito no encontrada'
    );
  END IF;

  -- Eliminar transacciones proyectadas anteriores de esta compra
  DELETE FROM transactions
  WHERE credit_purchase_id = p_credit_purchase_id
    AND is_projected = true;

  -- Generar una transacción por cada cuota
  FOR v_installment_number IN 1..v_credit_purchase.installments LOOP
    -- Calcular fecha de pago (mensual desde first_payment_date)
    v_payment_date := v_credit_purchase.first_payment_date + 
                      ((v_installment_number - 1) || ' months')::interval;

    -- Insertar transacción
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
      deleted_at
    ) VALUES (
      v_credit_purchase.user_id,
      v_credit_purchase.account_id,
      'expense',
      -ABS(v_credit_purchase.installment_amount),
      v_credit_purchase.description || ' - Cuota ' || v_installment_number || '/' || v_credit_purchase.installments,
      v_payment_date,
      'Compra a Crédito',
      'credit_purchase',
      p_credit_purchase_id,
      v_payment_date > v_today, -- Proyectada si es fecha futura
      false,
      NULL
    );

    v_transactions_created := v_transactions_created + 1;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'transactions_created', v_transactions_created,
    'credit_purchase_id', p_credit_purchase_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- =====================================================
-- 4. FUNCIÓN PARA CONVERTIR PROYECTADAS A REALES
-- =====================================================

CREATE OR REPLACE FUNCTION check_and_realize_projected_transactions()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated_count int := 0;
  v_today date := CURRENT_DATE;
BEGIN
  -- Convertir transacciones proyectadas cuya fecha ya pasó
  UPDATE transactions
  SET is_projected = false,
      updated_at = now()
  WHERE is_projected = true
    AND transaction_date <= v_today
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN json_build_object(
    'success', true,
    'transactions_realized', v_updated_count,
    'date', v_today
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- =====================================================
-- 5. ACTUALIZAR POLÍTICAS RLS PARA TRANSACCIONES
-- =====================================================

-- Las políticas SELECT deben incluir transacciones proyectadas para el forecast
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;

CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- =====================================================
-- 6. COMENTARIOS Y DOCUMENTACIÓN
-- =====================================================

COMMENT ON COLUMN transactions.is_projected IS 
  'Indica si la transacción es proyectada (futura). true = solo forecast, false = afecta saldo actual';

COMMENT ON COLUMN transactions.credit_purchase_id IS 
  'Relación con credit_purchases. Identifica transacciones generadas automáticamente como cuotas';

COMMENT ON FUNCTION generate_installment_transactions(uuid) IS 
  'Genera automáticamente transacciones de cuotas para una compra a crédito. Las cuotas futuras se marcan como proyectadas.';

COMMENT ON FUNCTION check_and_realize_projected_transactions() IS 
  'Convierte transacciones proyectadas en reales cuando su fecha llega. Debe ejecutarse diariamente.';

-- =====================================================
-- 7. VISTA HELPER PARA CONSULTAS COMUNES
-- =====================================================

-- Vista para obtener solo transacciones reales (sin proyectadas)
CREATE OR REPLACE VIEW transactions_real AS
SELECT * FROM transactions
WHERE is_projected = false
  AND deleted_at IS NULL;

-- Vista para obtener todas (reales + proyectadas)
CREATE OR REPLACE VIEW transactions_with_forecast AS
SELECT * FROM transactions
WHERE deleted_at IS NULL
ORDER BY transaction_date DESC;

COMMENT ON VIEW transactions_real IS 
  'Transacciones reales que afectan el saldo actual. Excluye proyectadas y eliminadas.';

COMMENT ON VIEW transactions_with_forecast IS 
  'Todas las transacciones incluyendo proyectadas (forecast). Excluye eliminadas.';
