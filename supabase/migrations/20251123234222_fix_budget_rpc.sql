/*
  # Corrección de la función RPC get_monthly_budget_status

  1. Cambios
    - Corregir referencia de columna `t.date` a `t.transaction_date`
    - Cambiar firma de función para aceptar `p_month date` en lugar de `p_year` y `p_month` separados
    - Simplificar comparación de mes usando `date_trunc`
    - Ajustar JOIN para usar `c.name = me.category` en lugar de `category_id`
    - Cambiar nombres de columnas de retorno para consistencia

  2. Retorna
    - category_id: ID de la categoría
    - category_name: Nombre de la categoría
    - limit_amount: Límite del presupuesto
    - spent_amount: Monto gastado
    - percentage: Porcentaje de uso (0-100+)

  3. Notas
    - Solo considera transacciones de tipo 'expense'
    - Solo transacciones reales (is_projected = false)
    - Solo transacciones no eliminadas (deleted_at IS NULL)
    - Ordena por porcentaje descendente
*/

CREATE OR REPLACE FUNCTION get_monthly_budget_status(
  p_month date
)
RETURNS TABLE (
  category_id uuid,
  category_name text,
  limit_amount numeric,
  spent_amount numeric,
  percentage numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH monthly_expenses AS (
    SELECT 
      t.category,
      COALESCE(SUM(t.amount), 0) as total_spent
    FROM transactions t
    WHERE t.user_id = auth.uid()
      AND t.type = 'expense'
      AND t.deleted_at IS NULL
      AND t.is_projected = false 
      AND date_trunc('month', t.transaction_date) = date_trunc('month', p_month)
    GROUP BY t.category
  )
  SELECT 
    c.id,
    c.name,
    COALESCE(cb.amount, 0) as limit_amount,
    COALESCE(me.total_spent, 0) as spent_amount,
    CASE 
      WHEN COALESCE(cb.amount, 0) > 0 THEN 
        ROUND((COALESCE(me.total_spent, 0) * 100.0 / cb.amount), 1)
      ELSE 0 
    END as percentage
  FROM categories c
  LEFT JOIN category_budgets cb ON c.id = cb.category_id
  LEFT JOIN monthly_expenses me ON c.name = me.category
  WHERE c.user_id = auth.uid()
    AND c.deleted_at IS NULL
  ORDER BY percentage DESC;
END;
$$;
