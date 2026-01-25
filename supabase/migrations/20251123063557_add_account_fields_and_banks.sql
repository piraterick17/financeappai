/*
  # Add card number, amount due fields and create banks table

  1. Changes to accounts table
    - Add `card_number` field (text, nullable, encrypted reference)
    - Add `amount_due` field (numeric, default 0, for credit cards)
  
  2. New Tables
    - `banks`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `name` (text)
      - `logo_url` (text, nullable)
      - `is_system` (boolean, default false for user-created banks)
      - `created_at` (timestamptz)
  
  3. Security
    - Enable RLS on `banks` table
    - Add policies for authenticated users to manage their banks
    - System banks (is_system = true) are visible to all
*/

-- Add new fields to accounts table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'card_number'
  ) THEN
    ALTER TABLE accounts ADD COLUMN card_number text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'amount_due'
  ) THEN
    ALTER TABLE accounts ADD COLUMN amount_due numeric DEFAULT 0;
  END IF;
END $$;

-- Create banks table
CREATE TABLE IF NOT EXISTS banks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  logo_url text,
  is_system boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE banks ENABLE ROW LEVEL SECURITY;

-- Users can view system banks and their own banks
CREATE POLICY "Users can view system banks and own banks"
  ON banks
  FOR SELECT
  TO authenticated
  USING (is_system = true OR auth.uid() = user_id);

-- Users can create their own banks
CREATE POLICY "Users can create own banks"
  ON banks
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_system = false);

-- Users can update their own banks (not system banks)
CREATE POLICY "Users can update own banks"
  ON banks
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND is_system = false)
  WITH CHECK (auth.uid() = user_id AND is_system = false);

-- Users can delete their own banks (not system banks)
CREATE POLICY "Users can delete own banks"
  ON banks
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id AND is_system = false);

-- Insert system banks (visible to all users)
INSERT INTO banks (name, is_system, user_id) VALUES
  ('BBVA', true, NULL),
  ('Santander', true, NULL),
  ('Citibanamex', true, NULL),
  ('HSBC', true, NULL),
  ('Banorte', true, NULL),
  ('Scotiabank', true, NULL),
  ('Inbursa', true, NULL),
  ('Azteca', true, NULL),
  ('Afirme', true, NULL),
  ('BanBajío', true, NULL),
  ('Banregio', true, NULL),
  ('Invex', true, NULL),
  ('Mifel', true, NULL),
  ('Ve por Más', true, NULL),
  ('American Express', true, NULL),
  ('Nu', true, NULL),
  ('Klar', true, NULL),
  ('Fondeadora', true, NULL),
  ('Mercado Pago', true, NULL),
  ('Rappi', true, NULL)
ON CONFLICT DO NOTHING;
