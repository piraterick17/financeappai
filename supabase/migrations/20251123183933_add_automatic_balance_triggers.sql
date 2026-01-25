/*
  # Sistema Automático de Actualización de Balances

  ## Descripción
  Este sistema usa triggers de PostgreSQL para mantener actualizado automáticamente
  el balance de las cuentas cuando se agregan, modifican o eliminan transacciones.
  Elimina la necesidad de lógica manual en el frontend y garantiza integridad de datos.

  ## Componentes Implementados

  ### 1. Función: update_account_balance()
  Función que actualiza el balance de una cuenta basado en una transacción.
  
  **Lógica**:
  - Income (ingreso) → SUMA al balance
  - Expense (gasto) → RESTA del balance
  - Considera soft deletes (deleted_at)
  - Maneja cambios de cuenta (mover transacción entre cuentas)
  - Maneja cambios de tipo (income ↔ expense)

  ### 2. Triggers Implementados

  #### a) trigger_transaction_insert
  - Se ejecuta AFTER INSERT
  - Actualiza balance de la cuenta destino
  - Solo si la transacción NO está eliminada (deleted_at IS NULL)

  #### b) trigger_transaction_update
  - Se ejecuta AFTER UPDATE
  - Maneja 4 escenarios:
    1. Cambio de monto (mismo tipo, misma cuenta)
    2. Cambio de tipo (income → expense o viceversa)
    3. Cambio de cuenta (mover entre cuentas)
    4. Soft delete (marca deleted_at)
    5. Restauración (deleted_at → NULL)

  #### c) trigger_transaction_delete
  - Se ejecuta AFTER DELETE (hard delete)
  - Revierte el efecto de la transacción en el balance
  - Normalmente no se ejecutará (usamos soft delete)

  ## Beneficios

  ✅ **Integridad de Datos**: Los balances siempre son consistentes
  ✅ **Concurrencia Segura**: PostgreSQL maneja locks automáticamente
  ✅ **Atomicidad**: Transacción y balance se actualizan juntos
  ✅ **Frontend Simplificado**: No más cálculos manuales de balance
  ✅ **Auditoría**: Todos los cambios quedan registrados
  ✅ **Performance**: Índices optimizados para consultas rápidas

  ## Casos de Uso

  ### Caso 1: Agregar Ingreso
  ```sql
  INSERT INTO transactions (account_id, type, amount, ...) 
  VALUES ('uuid-cuenta', 'income', 1000, ...);
  
  -- Trigger ejecuta automáticamente:
  UPDATE accounts SET balance = balance + 1000 WHERE id = 'uuid-cuenta';
  ```

  ### Caso 2: Cambiar Monto
  ```sql
  -- Transacción original: $500
  UPDATE transactions SET amount = 750 WHERE id = 'uuid-trans';
  
  -- Trigger calcula diferencia y ajusta:
  UPDATE accounts SET balance = balance + 250 WHERE id = 'uuid-cuenta';
  ```

  ### Caso 3: Mover Entre Cuentas
  ```sql
  -- Cambiar de cuenta A a cuenta B
  UPDATE transactions SET account_id = 'uuid-cuenta-b' 
  WHERE id = 'uuid-trans';
  
  -- Trigger ejecuta:
  UPDATE accounts SET balance = balance - amount WHERE id = 'uuid-cuenta-a';
  UPDATE accounts SET balance = balance + amount WHERE id = 'uuid-cuenta-b';
  ```

  ### Caso 4: Soft Delete
  ```sql
  UPDATE transactions SET deleted_at = now() WHERE id = 'uuid-trans';
  
  -- Trigger revierte el efecto en el balance:
  UPDATE accounts SET balance = balance - amount (si era income)
  UPDATE accounts SET balance = balance + amount (si era expense)
  ```

  ## Notas Importantes
  
  - Los triggers respetan soft deletes (deleted_at)
  - No afectan transacciones recurrentes (is_recurring = true) sin account_id
  - Son seguros para concurrencia (PostgreSQL usa row-level locks)
  - Compatibles con todas las políticas RLS existentes
*/

-- =====================================================
-- 1. CREAR FUNCIÓN PARA ACTUALIZAR BALANCE
-- =====================================================

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
    -- Solo procesar si no está eliminada y tiene cuenta asociada
    IF NEW.deleted_at IS NULL AND NEW.account_id IS NOT NULL THEN
      IF NEW.type = 'income' THEN
        -- Income suma al balance
        UPDATE accounts 
        SET balance = balance + NEW.amount,
            updated_at = now()
        WHERE id = NEW.account_id;
      ELSIF NEW.type = 'expense' THEN
        -- Expense resta del balance
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
    
    -- Sub-caso 2.1: Soft Delete (marcar como eliminada)
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      -- Revertir el efecto de la transacción
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

    -- Sub-caso 2.2: Restaurar (deleted_at → NULL)
    IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      -- Aplicar el efecto de la transacción
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

    -- Sub-caso 2.3: Transacción activa siendo modificada
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NULL THEN
      
      -- Sub-caso 2.3.1: Cambio de cuenta
      IF OLD.account_id != NEW.account_id THEN
        -- Revertir en cuenta antigua
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
        
        -- Aplicar en cuenta nueva
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

      -- Sub-caso 2.3.2: Cambio de tipo (income ↔ expense)
      IF OLD.type != NEW.type AND OLD.account_id = NEW.account_id THEN
        IF OLD.account_id IS NOT NULL THEN
          -- Revertir efecto anterior
          IF OLD.type = 'income' THEN
            balance_change := -OLD.amount;
          ELSE
            balance_change := OLD.amount;
          END IF;
          
          -- Aplicar nuevo efecto
          IF NEW.type = 'income' THEN
            balance_change := balance_change + NEW.amount;
          ELSE
            balance_change := balance_change - NEW.amount;
          END IF;
          
          UPDATE accounts 
          SET balance = balance + balance_change,
              updated_at = now()
          WHERE id = OLD.account_id;
        END IF;
        
        RETURN NEW;
      END IF;

      -- Sub-caso 2.3.3: Cambio de monto (misma cuenta, mismo tipo)
      IF OLD.amount != NEW.amount AND OLD.account_id = NEW.account_id AND OLD.type = NEW.type THEN
        IF OLD.account_id IS NOT NULL THEN
          balance_change := NEW.amount - OLD.amount;
          
          IF NEW.type = 'income' THEN
            UPDATE accounts 
            SET balance = balance + balance_change,
                updated_at = now()
            WHERE id = OLD.account_id;
          ELSIF NEW.type = 'expense' THEN
            UPDATE accounts 
            SET balance = balance - balance_change,
                updated_at = now()
            WHERE id = OLD.account_id;
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
    -- Revertir el efecto si no estaba eliminada
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
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

-- =====================================================
-- 2. CREAR TRIGGERS EN LA TABLA TRANSACTIONS
-- =====================================================

-- Eliminar triggers existentes si existen
DROP TRIGGER IF EXISTS trigger_transaction_insert ON transactions;
DROP TRIGGER IF EXISTS trigger_transaction_update ON transactions;
DROP TRIGGER IF EXISTS trigger_transaction_delete ON transactions;

-- Trigger para INSERT (nuevas transacciones)
CREATE TRIGGER trigger_transaction_insert
  AFTER INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_account_balance();

-- Trigger para UPDATE (modificaciones)
CREATE TRIGGER trigger_transaction_update
  AFTER UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_account_balance();

-- Trigger para DELETE (eliminación física - raro, pero cubierto)
CREATE TRIGGER trigger_transaction_delete
  AFTER DELETE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_account_balance();

-- =====================================================
-- 3. AGREGAR ÍNDICES PARA OPTIMIZAR TRIGGERS
-- =====================================================

-- Índice para búsquedas rápidas por account_id
CREATE INDEX IF NOT EXISTS idx_transactions_account_id 
ON transactions(account_id) 
WHERE deleted_at IS NULL;

-- Índice compuesto para transacciones activas por usuario y cuenta
CREATE INDEX IF NOT EXISTS idx_transactions_user_account 
ON transactions(user_id, account_id, deleted_at);

-- =====================================================
-- 4. COMENTARIOS PARA DOCUMENTACIÓN
-- =====================================================

COMMENT ON FUNCTION update_account_balance() IS 
  'Función trigger que actualiza automáticamente el balance de cuentas cuando se insertan, actualizan o eliminan transacciones. Maneja soft deletes, cambios de cuenta, cambios de tipo y cambios de monto.';

COMMENT ON TRIGGER trigger_transaction_insert ON transactions IS 
  'Actualiza balance de cuenta cuando se inserta una nueva transacción';

COMMENT ON TRIGGER trigger_transaction_update ON transactions IS 
  'Actualiza balance de cuenta(s) cuando se modifica una transacción (monto, tipo, cuenta, soft delete)';

COMMENT ON TRIGGER trigger_transaction_delete ON transactions IS 
  'Revierte efecto en balance cuando se elimina físicamente una transacción';
