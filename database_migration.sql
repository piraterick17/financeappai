-- Personal Finance System Database Schema
-- Run this SQL in your Supabase SQL Editor

-- Create users table (extends auth.users)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  color text DEFAULT '#6B7280',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own categories"
  ON categories FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

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

-- Create accounts table
CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('debit', 'credit', 'savings', 'investment')),
  bank_name text NOT NULL,
  balance decimal(15, 2) DEFAULT 0,
  credit_limit decimal(15, 2),
  currency text DEFAULT 'MXN',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own accounts"
  ON accounts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

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

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  amount decimal(15, 2) NOT NULL,
  description text NOT NULL,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  is_recurring boolean DEFAULT false,
  recurrence_period text CHECK (recurrence_period IN ('daily', 'weekly', 'monthly', 'yearly')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

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

-- Create fixed_expenses table
CREATE TABLE IF NOT EXISTS fixed_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  amount decimal(15, 2) NOT NULL,
  due_day integer NOT NULL CHECK (due_day >= 1 AND due_day <= 31),
  is_active boolean DEFAULT true,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE fixed_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own fixed expenses"
  ON fixed_expenses FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

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

-- Create credit_purchases table
CREATE TABLE IF NOT EXISTS credit_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  description text NOT NULL,
  total_amount decimal(15, 2) NOT NULL,
  installments integer NOT NULL CHECK (installments > 0),
  installment_amount decimal(15, 2) NOT NULL,
  interest_rate decimal(5, 2) DEFAULT 0,
  first_payment_date date NOT NULL,
  remaining_installments integer NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE credit_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credit purchases"
  ON credit_purchases FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

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

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_purchases_user ON credit_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_fixed_expenses_user ON fixed_expenses(user_id);
