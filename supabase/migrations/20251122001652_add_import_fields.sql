/*
  # Add Import and Transaction Enhancement Fields

  1. Changes to transactions table
    - Add transaction_time (time) - Store transaction time
    - Add transaction_consecutive (text) - Credit card consecutive number
    - Add currency (text) - Transaction currency (MXN, USD, etc.)
    - Add original_description (text) - Original unprocessed description
    - Add import_source (text) - Source of transaction (manual, santander_debit, etc.)
    - Add import_batch_id (uuid) - Group transactions from same import
    - Add is_duplicate (boolean) - Flag potential duplicates
    - Add category (text) - Simple category field for now

  2. New table: import_history
    - Track all import operations
    - Store statistics and metadata
    - Enable import rollback functionality

  3. Indexes
    - Composite index for duplicate detection
    - Index on import_batch_id for grouping

  4. Security
    - RLS policies for import_history table
*/

-- Add new fields to transactions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'transaction_time'
  ) THEN
    ALTER TABLE transactions ADD COLUMN transaction_time time;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'transaction_consecutive'
  ) THEN
    ALTER TABLE transactions ADD COLUMN transaction_consecutive text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'currency'
  ) THEN
    ALTER TABLE transactions ADD COLUMN currency text DEFAULT 'MXN';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'original_description'
  ) THEN
    ALTER TABLE transactions ADD COLUMN original_description text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'import_source'
  ) THEN
    ALTER TABLE transactions ADD COLUMN import_source text DEFAULT 'manual';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'import_batch_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN import_batch_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'is_duplicate'
  ) THEN
    ALTER TABLE transactions ADD COLUMN is_duplicate boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'category'
  ) THEN
    ALTER TABLE transactions ADD COLUMN category text;
  END IF;
END $$;

-- Create import_history table
CREATE TABLE IF NOT EXISTS import_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('csv', 'xlsx', 'xls')),
  bank_name text NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('debit', 'credit', 'savings', 'investment')),
  total_rows integer NOT NULL DEFAULT 0,
  successful_imports integer NOT NULL DEFAULT 0,
  failed_imports integer NOT NULL DEFAULT 0,
  duplicate_count integer NOT NULL DEFAULT 0,
  import_date timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'partial', 'failed')),
  error_details jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE import_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own import history"
  ON import_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own import history"
  ON import_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own import history"
  ON import_history FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own import history"
  ON import_history FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_transactions_duplicate_detection
  ON transactions(user_id, account_id, transaction_date, amount);

CREATE INDEX IF NOT EXISTS idx_transactions_import_batch
  ON transactions(import_batch_id);

CREATE INDEX IF NOT EXISTS idx_transactions_import_source
  ON transactions(import_source);

CREATE INDEX IF NOT EXISTS idx_import_history_user_account
  ON import_history(user_id, account_id);

CREATE INDEX IF NOT EXISTS idx_import_history_date
  ON import_history(import_date DESC);