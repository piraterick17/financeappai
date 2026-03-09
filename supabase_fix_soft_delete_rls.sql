-- =============================================
-- Fix: Allow soft-delete UPDATE on transactions
-- =============================================
-- 
-- Problem: The current UPDATE policy WITH CHECK only allows updates
-- where user_id = auth.uid(), but the SELECT policy requires 
-- deleted_at IS NULL. When we set deleted_at (soft delete), 
-- Supabase's RLS rejects it because the "new row" would violate
-- the SELECT policy check.
--
-- Solution: Drop and recreate the UPDATE policy to explicitly
-- allow setting deleted_at while still checking user ownership.
-- =============================================

-- Fix transactions UPDATE policy
DROP POLICY IF EXISTS "Users can update own transactions" ON transactions;

CREATE POLICY "Users can update own transactions"
  ON transactions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Fix accounts UPDATE policy (same issue)
DROP POLICY IF EXISTS "Users can update own accounts" ON accounts;

CREATE POLICY "Users can update own accounts"
  ON accounts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Fix categories UPDATE policy (same issue)
DROP POLICY IF EXISTS "Users can update own categories" ON categories;

CREATE POLICY "Users can update own categories"
  ON categories FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Fix fixed_expenses UPDATE policy (same issue)
DROP POLICY IF EXISTS "Users can update own fixed expenses" ON fixed_expenses;

CREATE POLICY "Users can update own fixed expenses"
  ON fixed_expenses FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Fix credit_purchases UPDATE policy (same issue)
DROP POLICY IF EXISTS "Users can update own credit purchases" ON credit_purchases;

CREATE POLICY "Users can update own credit purchases"
  ON credit_purchases FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Fix suppliers UPDATE policy (same issue)
DROP POLICY IF EXISTS "Users can update own suppliers" ON suppliers;

CREATE POLICY "Users can update own suppliers"
  ON suppliers FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
