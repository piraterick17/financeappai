/*
  # Sistema de Límites de Presupuesto

  1. Nueva Tabla
    - `category_budgets`
      - `id` (uuid, primary key) - Identificador único del presupuesto
      - `user_id` (uuid, foreign key) - Usuario propietario del presupuesto
      - `category_id` (uuid, foreign key) - Categoría asociada al presupuesto
      - `amount` (numeric) - Límite mensual del presupuesto
      - `created_at` (timestamptz) - Fecha de creación del presupuesto
      - `updated_at` (timestamptz) - Fecha de última actualización
      - `UNIQUE(user_id, category_id)` - Solo un presupuesto por categoría por usuario

  2. Seguridad
    - Habilitar RLS en `category_budgets`
    - Políticas para SELECT, INSERT, UPDATE, DELETE solo para datos propios del usuario

  3. Función RPC
    - `get_monthly_budget_status` - Obtiene el estado del presupuesto mensual
      - Parámetros: p_year (integer), p_month (integer)
      - Retorna: category_id, category_name, spent, budget_limit, percentage_used
      - Suma transacciones reales del mes agrupadas por categoría
      - JOIN con category_budgets para obtener los límites
      - Calcula porcentaje de uso

  4. Notas Importantes
    - Solo considera transacciones con is_projected = false
    - Solo considera transacciones de tipo 'expense' (gastos)
    - El porcentaje de uso puede ser mayor a 100 si se excede el presupuesto
    - Ordena resultados por porcentaje de uso descendente
*/

-- Crear tabla category_budgets
CREATE TABLE IF NOT EXISTS category_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_user_category_budget UNIQUE (user_id, category_id)
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_category_budgets_user_id ON category_budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_category_budgets_category_id ON category_budgets(category_id);

-- Habilitar RLS
ALTER TABLE category_budgets ENABLE ROW LEVEL SECURITY;

-- Política SELECT: Los usuarios solo pueden ver sus propios presupuestos
CREATE POLICY "Users can view own budgets"
  ON category_budgets
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Política INSERT: Los usuarios solo pueden crear sus propios presupuestos
CREATE POLICY "Users can create own budgets"
  ON category_budgets
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Política UPDATE: Los usuarios solo pueden actualizar sus propios presupuestos
CREATE POLICY "Users can update own budgets"
  ON category_budgets
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Política DELETE: Los usuarios solo pueden eliminar sus propios presupuestos
CREATE POLICY "Users can delete own budgets"
  ON category_budgets
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_category_budgets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_category_budgets_timestamp
  BEFORE UPDATE ON category_budgets
  FOR EACH ROW
  EXECUTE FUNCTION update_category_budgets_updated_at();

-- Función RPC: get_monthly_budget_status
CREATE OR REPLACE FUNCTION get_monthly_budget_status(
  p_year integer,
  p_month integer
)
RETURNS TABLE (
  category_id uuid,
  category_name text,
  category_color text,
  spent numeric,
  budget_limit numeric,
  percentage_used numeric
) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH monthly_expenses AS (
    -- Sumar gastos reales del mes agrupados por categoría
    SELECT 
      t.category_id,
      COALESCE(SUM(ABS(t.amount)), 0) as total_spent
    FROM transactions t
    WHERE 
      t.user_id = auth.uid()
      AND t.type = 'expense'
      AND t.is_projected = false
      AND t.deleted_at IS NULL
      AND EXTRACT(YEAR FROM t.date) = p_year
      AND EXTRACT(MONTH FROM t.date) = p_month
    GROUP BY t.category_id
  )
  SELECT 
    c.id as category_id,
    c.name as category_name,
    c.color as category_color,
    COALESCE(me.total_spent, 0) as spent,
    cb.amount as budget_limit,
    CASE 
      WHEN cb.amount > 0 THEN ROUND((COALESCE(me.total_spent, 0) / cb.amount * 100), 2)
      ELSE 0
    END as percentage_used
  FROM category_budgets cb
  INNER JOIN categories c ON c.id = cb.category_id
  LEFT JOIN monthly_expenses me ON me.category_id = cb.category_id
  WHERE 
    cb.user_id = auth.uid()
    AND c.deleted_at IS NULL
  ORDER BY percentage_used DESC;
END;
$$ LANGUAGE plpgsql;
