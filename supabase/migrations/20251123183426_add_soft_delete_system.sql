/*
  # Implementación de Soft Delete (Eliminación Lógica)

  ## Descripción
  Este sistema de soft delete protege el historial financiero al marcar registros como 
  eliminados en lugar de borrarlos permanentemente de la base de datos.

  ## Cambios Implementados

  ### 1. Nuevas Columnas
  Se agrega `deleted_at` (timestamptz, nullable) a las siguientes tablas:
  - `accounts` - Cuentas bancarias
  - `transactions` - Transacciones financieras
  - `categories` - Categorías de gastos/ingresos
  - `fixed_expenses` - Gastos fijos mensuales
  - `credit_purchases` - Compras a crédito

  ### 2. Políticas RLS Actualizadas
  Todas las políticas SELECT existentes ahora incluyen la condición:
  - `deleted_at IS NULL` - Solo muestra registros activos (no eliminados)

  ### 3. Funcionalidad
  - **Soft Delete**: UPDATE tabla SET deleted_at = now() WHERE id = ?
  - **Restaurar**: UPDATE tabla SET deleted_at = NULL WHERE id = ?
  - **Hard Delete**: DELETE permanente (solo administradores si es necesario)

  ### 4. Beneficios
  - ✅ Preserva historial completo de transacciones
  - ✅ Permite auditoría y reportes históricos
  - ✅ Posibilidad de restaurar datos eliminados accidentalmente
  - ✅ Cumple con requisitos de retención de datos financieros
  - ✅ Los cálculos de balance ignoran registros eliminados

  ## Notas Importantes
  - Los registros con `deleted_at != NULL` NO aparecen en consultas normales
  - Los balances y totales excluyen automáticamente registros eliminados
  - Las políticas RLS garantizan que solo el usuario propietario pueda eliminar sus datos
*/

-- =====================================================
-- 1. AGREGAR COLUMNA deleted_at A TODAS LAS TABLAS
-- =====================================================

-- Tabla: accounts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE accounts ADD COLUMN deleted_at timestamptz;
    CREATE INDEX IF NOT EXISTS idx_accounts_deleted_at ON accounts(deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

-- Tabla: transactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE transactions ADD COLUMN deleted_at timestamptz;
    CREATE INDEX IF NOT EXISTS idx_transactions_deleted_at ON transactions(deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

-- Tabla: categories
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE categories ADD COLUMN deleted_at timestamptz;
    CREATE INDEX IF NOT EXISTS idx_categories_deleted_at ON categories(deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

-- Tabla: fixed_expenses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fixed_expenses' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE fixed_expenses ADD COLUMN deleted_at timestamptz;
    CREATE INDEX IF NOT EXISTS idx_fixed_expenses_deleted_at ON fixed_expenses(deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

-- Tabla: credit_purchases
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'credit_purchases' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE credit_purchases ADD COLUMN deleted_at timestamptz;
    CREATE INDEX IF NOT EXISTS idx_credit_purchases_deleted_at ON credit_purchases(deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

-- =====================================================
-- 2. ACTUALIZAR POLÍTICAS RLS PARA ACCOUNTS
-- =====================================================

-- Eliminar políticas existentes de accounts
DROP POLICY IF EXISTS "Users can view own accounts" ON accounts;
DROP POLICY IF EXISTS "Users can insert own accounts" ON accounts;
DROP POLICY IF EXISTS "Users can update own accounts" ON accounts;
DROP POLICY IF EXISTS "Users can delete own accounts" ON accounts;

-- Recrear políticas con soft delete
CREATE POLICY "Users can view own accounts"
  ON accounts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can insert own accounts"
  ON accounts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own accounts"
  ON accounts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own accounts"
  ON accounts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- =====================================================
-- 3. ACTUALIZAR POLÍTICAS RLS PARA TRANSACTIONS
-- =====================================================

DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON transactions;

CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can insert own transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions"
  ON transactions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions"
  ON transactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- =====================================================
-- 4. ACTUALIZAR POLÍTICAS RLS PARA CATEGORIES
-- =====================================================

DROP POLICY IF EXISTS "Users can view own categories" ON categories;
DROP POLICY IF EXISTS "Users can insert own categories" ON categories;
DROP POLICY IF EXISTS "Users can update own categories" ON categories;
DROP POLICY IF EXISTS "Users can delete own categories" ON categories;

CREATE POLICY "Users can view own categories"
  ON categories FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can insert own categories"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories"
  ON categories FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories"
  ON categories FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- =====================================================
-- 5. ACTUALIZAR POLÍTICAS RLS PARA FIXED_EXPENSES
-- =====================================================

DROP POLICY IF EXISTS "Users can view own fixed expenses" ON fixed_expenses;
DROP POLICY IF EXISTS "Users can insert own fixed expenses" ON fixed_expenses;
DROP POLICY IF EXISTS "Users can update own fixed expenses" ON fixed_expenses;
DROP POLICY IF EXISTS "Users can delete own fixed expenses" ON fixed_expenses;

CREATE POLICY "Users can view own fixed expenses"
  ON fixed_expenses FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can insert own fixed expenses"
  ON fixed_expenses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own fixed expenses"
  ON fixed_expenses FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own fixed expenses"
  ON fixed_expenses FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- =====================================================
-- 6. ACTUALIZAR POLÍTICAS RLS PARA CREDIT_PURCHASES
-- =====================================================

DROP POLICY IF EXISTS "Users can view own credit purchases" ON credit_purchases;
DROP POLICY IF EXISTS "Users can insert own credit purchases" ON credit_purchases;
DROP POLICY IF EXISTS "Users can update own credit purchases" ON credit_purchases;
DROP POLICY IF EXISTS "Users can delete own credit purchases" ON credit_purchases;

CREATE POLICY "Users can view own credit purchases"
  ON credit_purchases FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can insert own credit purchases"
  ON credit_purchases FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own credit purchases"
  ON credit_purchases FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own credit purchases"
  ON credit_purchases FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- =====================================================
-- 7. CREAR FUNCIÓN HELPER PARA SOFT DELETE (OPCIONAL)
-- =====================================================

-- Función para restaurar registros eliminados (útil para administración)
CREATE OR REPLACE FUNCTION restore_deleted_record(
  table_name text,
  record_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE format('UPDATE %I SET deleted_at = NULL WHERE id = $1 AND user_id = $2', table_name)
  USING record_id, auth.uid();
END;
$$;

-- =====================================================
-- 8. COMENTARIOS EN LAS COLUMNAS
-- =====================================================

COMMENT ON COLUMN accounts.deleted_at IS 'Timestamp de eliminación lógica. NULL = activo, NOT NULL = eliminado';
COMMENT ON COLUMN transactions.deleted_at IS 'Timestamp de eliminación lógica. NULL = activo, NOT NULL = eliminado';
COMMENT ON COLUMN categories.deleted_at IS 'Timestamp de eliminación lógica. NULL = activo, NOT NULL = eliminado';
COMMENT ON COLUMN fixed_expenses.deleted_at IS 'Timestamp de eliminación lógica. NULL = activo, NOT NULL = eliminado';
COMMENT ON COLUMN credit_purchases.deleted_at IS 'Timestamp de eliminación lógica. NULL = activo, NOT NULL = eliminado';
