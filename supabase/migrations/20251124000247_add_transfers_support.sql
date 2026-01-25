/*
  # Sistema de Transferencias y Pagos a Tarjeta

  1. Nuevas Columnas en transactions
    - `transfer_group_id` (uuid, nullable) - Agrupa transacciones que son parte de la misma transferencia
    - `is_transfer` (boolean, default false) - Indica si la transacción es parte de una transferencia

  2. Índice
    - Índice en `transfer_group_id` para mejorar búsquedas de transferencias relacionadas

  3. Función RPC: register_transfer
    - Registra una transferencia entre dos cuentas
    - Parámetros:
      - p_user_id: ID del usuario
      - p_source_account_id: Cuenta de origen (de donde sale el dinero)
      - p_destination_account_id: Cuenta de destino (donde entra el dinero)
      - p_amount: Monto a transferir
      - p_date: Fecha de la transferencia
      - p_description: Descripción opcional
    - Crea dos transacciones vinculadas:
      - Una de tipo 'expense' en la cuenta origen
      - Una de tipo 'income' en la cuenta destino
    - Ambas comparten el mismo transfer_group_id

  4. Trigger: trigger_delete_transfer_group
    - Se activa cuando se hace soft-delete de una transacción (UPDATE deleted_at)
    - Si la transacción eliminada tiene transfer_group_id:
      - Busca la transacción hermana con el mismo transfer_group_id
      - Hace soft-delete de la transacción hermana automáticamente
    - Garantiza integridad: no puede existir solo una mitad de la transferencia

  5. Notas Importantes
    - Las transferencias NO afectan el patrimonio total (una cuenta pierde, otra gana)
    - El campo is_transfer permite filtrar transferencias en reportes si es necesario
    - El trigger solo aplica a soft-deletes, no a hard deletes
    - Las transferencias entre cuentas del mismo usuario no generan ingreso/gasto real
*/

-- Agregar nuevas columnas a transactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'transfer_group_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN transfer_group_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'is_transfer'
  ) THEN
    ALTER TABLE transactions ADD COLUMN is_transfer boolean DEFAULT false;
  END IF;
END $$;

-- Crear índice para transfer_group_id
CREATE INDEX IF NOT EXISTS idx_transactions_transfer_group_id 
ON transactions(transfer_group_id) 
WHERE transfer_group_id IS NOT NULL;

-- Función RPC: register_transfer
CREATE OR REPLACE FUNCTION register_transfer(
  p_user_id uuid,
  p_source_account_id uuid,
  p_destination_account_id uuid,
  p_amount numeric,
  p_date date,
  p_description text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id uuid;
  v_source_account_name text;
  v_destination_account_name text;
  v_final_description text;
BEGIN
  -- Validaciones básicas
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'El monto debe ser mayor a cero';
  END IF;

  IF p_source_account_id = p_destination_account_id THEN
    RAISE EXCEPTION 'Las cuentas de origen y destino deben ser diferentes';
  END IF;

  -- Verificar que ambas cuentas pertenecen al usuario
  IF NOT EXISTS (
    SELECT 1 FROM accounts 
    WHERE id = p_source_account_id 
    AND user_id = p_user_id 
    AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'La cuenta de origen no existe o no pertenece al usuario';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM accounts 
    WHERE id = p_destination_account_id 
    AND user_id = p_user_id 
    AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'La cuenta de destino no existe o no pertenece al usuario';
  END IF;

  -- Generar ID de grupo único para vincular ambas transacciones
  v_group_id := gen_random_uuid();

  -- Obtener nombres de las cuentas para las descripciones
  SELECT name INTO v_source_account_name
  FROM accounts
  WHERE id = p_source_account_id;

  SELECT name INTO v_destination_account_name
  FROM accounts
  WHERE id = p_destination_account_id;

  -- Usar descripción personalizada o generar una automática
  v_final_description := COALESCE(p_description, 'Transferencia');

  -- Insertar transacción de SALIDA (expense) en cuenta origen
  INSERT INTO transactions (
    user_id,
    account_id,
    type,
    amount,
    description,
    transaction_date,
    transfer_group_id,
    is_transfer,
    is_projected
  ) VALUES (
    p_user_id,
    p_source_account_id,
    'expense',
    p_amount,
    'Transferencia a ' || v_destination_account_name,
    p_date,
    v_group_id,
    true,
    false
  );

  -- Insertar transacción de ENTRADA (income) en cuenta destino
  INSERT INTO transactions (
    user_id,
    account_id,
    type,
    amount,
    description,
    transaction_date,
    transfer_group_id,
    is_transfer,
    is_projected
  ) VALUES (
    p_user_id,
    p_destination_account_id,
    'income',
    p_amount,
    'Transferencia desde ' || v_source_account_name,
    p_date,
    v_group_id,
    true,
    false
  );

  RETURN true;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error al registrar transferencia: %', SQLERRM;
    RETURN false;
END;
$$;

-- Función para el trigger: eliminar transacción hermana al hacer soft-delete
CREATE OR REPLACE FUNCTION soft_delete_transfer_group()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Solo actuar si se está haciendo soft-delete (deleted_at pasa de NULL a NOT NULL)
  -- y la transacción es parte de una transferencia
  IF OLD.deleted_at IS NULL 
     AND NEW.deleted_at IS NOT NULL 
     AND NEW.transfer_group_id IS NOT NULL 
     AND NEW.is_transfer = true 
  THEN
    -- Hacer soft-delete de la transacción hermana con el mismo transfer_group_id
    UPDATE transactions
    SET deleted_at = NEW.deleted_at
    WHERE transfer_group_id = NEW.transfer_group_id
      AND id != NEW.id
      AND deleted_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- Crear trigger en transactions
DROP TRIGGER IF EXISTS trigger_delete_transfer_group ON transactions;

CREATE TRIGGER trigger_delete_transfer_group
  AFTER UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION soft_delete_transfer_group();

-- Comentarios para documentación
COMMENT ON COLUMN transactions.transfer_group_id IS 'UUID que agrupa las dos transacciones que forman una transferencia. NULL si no es transferencia.';
COMMENT ON COLUMN transactions.is_transfer IS 'Indica si esta transacción es parte de una transferencia entre cuentas del usuario.';
COMMENT ON FUNCTION register_transfer IS 'Registra una transferencia entre dos cuentas del usuario, creando dos transacciones vinculadas.';
COMMENT ON FUNCTION soft_delete_transfer_group IS 'Función de trigger que elimina automáticamente la transacción hermana cuando se hace soft-delete de una transferencia.';
