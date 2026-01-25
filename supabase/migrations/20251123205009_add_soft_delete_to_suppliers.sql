/*
  # Add Soft Delete to Suppliers Table

  ## Description
  Adds soft delete functionality to the suppliers table to maintain data integrity
  and allow for data recovery if needed.

  ## Changes
  1. Add `deleted_at` column to suppliers table
  2. Create index for performance on deleted_at filtering
  3. Update RLS policies to exclude soft-deleted records

  ## Benefits
  - Preserves supplier history in transactions
  - Allows restoration of accidentally deleted suppliers
  - Maintains referential integrity
*/

-- Add deleted_at column to suppliers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'suppliers' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE suppliers ADD COLUMN deleted_at timestamptz;
    CREATE INDEX IF NOT EXISTS idx_suppliers_deleted_at ON suppliers(deleted_at) WHERE deleted_at IS NULL;
  END IF;
END $$;

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view own suppliers" ON suppliers;

-- Recreate SELECT policy with deleted_at filter
CREATE POLICY "Users can view own suppliers"
  ON suppliers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NULL);