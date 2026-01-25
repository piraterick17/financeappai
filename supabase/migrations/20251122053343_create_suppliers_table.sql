/*
  # Create suppliers table

  1. New Tables
    - `suppliers`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `name` (text)
      - `default_category` (text, nullable)
      - `is_favorite` (boolean, default false)
      - `created_at` (timestamptz)
  
  2. Security
    - Enable RLS on `suppliers` table
    - Add policies for authenticated users to manage their own suppliers
*/

CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  default_category text,
  is_favorite boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own suppliers"
  ON suppliers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own suppliers"
  ON suppliers
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own suppliers"
  ON suppliers
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own suppliers"
  ON suppliers
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add supplier_id to transactions table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'supplier_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add is_recurring to transactions table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'is_recurring'
  ) THEN
    ALTER TABLE transactions ADD COLUMN is_recurring boolean DEFAULT false;
  END IF;
END $$;

-- Add recurring_frequency to transactions table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'recurring_frequency'
  ) THEN
    ALTER TABLE transactions ADD COLUMN recurring_frequency text;
  END IF;
END $$;

-- Add recurring_day to transactions table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'recurring_day'
  ) THEN
    ALTER TABLE transactions ADD COLUMN recurring_day integer;
  END IF;
END $$;
