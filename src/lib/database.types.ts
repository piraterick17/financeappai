export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      categories: {
        Row: {
          id: string
          user_id: string
          name: string
          type: 'income' | 'expense'
          color: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          type: 'income' | 'expense'
          color?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          type?: 'income' | 'expense'
          color?: string
          created_at?: string
        }
      }
      accounts: {
        Row: {
          id: string
          user_id: string
          name: string
          type: 'debit' | 'credit' | 'savings' | 'investment'
          bank_name: string
          balance: number
          credit_limit: number | null
          currency: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          type: 'debit' | 'credit' | 'savings' | 'investment'
          bank_name: string
          balance?: number
          credit_limit?: number | null
          currency?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          type?: 'debit' | 'credit' | 'savings' | 'investment'
          bank_name?: string
          balance?: number
          credit_limit?: number | null
          currency?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          account_id: string
          category_id: string | null
          type: 'income' | 'expense'
          amount: number
          description: string
          transaction_date: string
          is_recurring: boolean
          recurrence_period: 'daily' | 'weekly' | 'monthly' | 'yearly' | null
          transaction_time: string | null
          transaction_consecutive: string | null
          currency: string
          original_description: string | null
          import_source: string
          import_batch_id: string | null
          is_duplicate: boolean
          category: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          account_id: string
          category_id?: string | null
          type: 'income' | 'expense'
          amount: number
          description: string
          transaction_date?: string
          is_recurring?: boolean
          recurrence_period?: 'daily' | 'weekly' | 'monthly' | 'yearly' | null
          transaction_time?: string | null
          transaction_consecutive?: string | null
          currency?: string
          original_description?: string | null
          import_source?: string
          import_batch_id?: string | null
          is_duplicate?: boolean
          category?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          account_id?: string
          category_id?: string | null
          type?: 'income' | 'expense'
          amount?: number
          description?: string
          transaction_date?: string
          is_recurring?: boolean
          recurrence_period?: 'daily' | 'weekly' | 'monthly' | 'yearly' | null
          transaction_time?: string | null
          transaction_consecutive?: string | null
          currency?: string
          original_description?: string | null
          import_source?: string
          import_batch_id?: string | null
          is_duplicate?: boolean
          category?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      import_history: {
        Row: {
          id: string
          user_id: string
          account_id: string
          file_name: string
          file_type: 'csv' | 'xlsx' | 'xls'
          bank_name: string
          account_type: 'debit' | 'credit' | 'savings' | 'investment'
          total_rows: number
          successful_imports: number
          failed_imports: number
          duplicate_count: number
          import_date: string
          status: 'pending' | 'success' | 'partial' | 'failed'
          error_details: any | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          account_id: string
          file_name: string
          file_type: 'csv' | 'xlsx' | 'xls'
          bank_name: string
          account_type: 'debit' | 'credit' | 'savings' | 'investment'
          total_rows?: number
          successful_imports?: number
          failed_imports?: number
          duplicate_count?: number
          import_date?: string
          status?: 'pending' | 'success' | 'partial' | 'failed'
          error_details?: any | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          account_id?: string
          file_name?: string
          file_type?: 'csv' | 'xlsx' | 'xls'
          bank_name?: string
          account_type?: 'debit' | 'credit' | 'savings' | 'investment'
          total_rows?: number
          successful_imports?: number
          failed_imports?: number
          duplicate_count?: number
          import_date?: string
          status?: 'pending' | 'success' | 'partial' | 'failed'
          error_details?: any | null
          created_at?: string
        }
      }
      fixed_expenses: {
        Row: {
          id: string
          user_id: string
          account_id: string
          category_id: string | null
          name: string
          amount: number
          due_day: number
          is_active: boolean
          start_date: string
          end_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          account_id: string
          category_id?: string | null
          name: string
          amount: number
          due_day: number
          is_active?: boolean
          start_date?: string
          end_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          account_id?: string
          category_id?: string | null
          name?: string
          amount?: number
          due_day?: number
          is_active?: boolean
          start_date?: string
          end_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      credit_purchases: {
        Row: {
          id: string
          user_id: string
          account_id: string
          category_id: string | null
          description: string
          total_amount: number
          installments: number
          installment_amount: number
          interest_rate: number
          first_payment_date: string
          remaining_installments: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          account_id: string
          category_id?: string | null
          description: string
          total_amount: number
          installments: number
          installment_amount: number
          interest_rate?: number
          first_payment_date: string
          remaining_installments: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          account_id?: string
          category_id?: string | null
          description?: string
          total_amount?: number
          installments?: number
          installment_amount?: number
          interest_rate?: number
          first_payment_date?: string
          remaining_installments?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      suppliers: {
        Row: {
          id: string
          user_id: string
          name: string
          default_category: string | null
          is_favorite: boolean
          deleted_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          default_category?: string | null
          is_favorite?: boolean
          deleted_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          default_category?: string | null
          is_favorite?: boolean
          deleted_at?: string | null
          created_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
