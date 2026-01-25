import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';

type Transaction = Database['public']['Tables']['transactions']['Row'];

export interface TransactionFilters {
  userId: string;
  accountIds?: string[];
  startDate?: string;
  endDate?: string;
  type?: 'income' | 'expense';
  categories?: string[];
  supplierId?: string;
  searchTerm?: string;
  page?: number;
  itemsPerPage?: number;
  includeProjected?: boolean;
  isRecurring?: boolean;
  isTransfer?: boolean;
  minAmount?: number;
  maxAmount?: number;
}

export interface TransactionWithAccount extends Transaction {
  accounts: { name: string; type: string } | null;
}

export interface TransactionsResponse {
  transactions: TransactionWithAccount[];
  totalCount: number;
}

async function fetchTransactions(filters: TransactionFilters): Promise<TransactionsResponse> {
  const page = filters.page || 1;
  const itemsPerPage = filters.itemsPerPage || 25;
  const start = (page - 1) * itemsPerPage;
  const end = start + itemsPerPage - 1;

  let countQuery = supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', filters.userId)
    .is('deleted_at', null);

  let dataQuery = supabase
    .from('transactions')
    .select('*, accounts(name, type)')
    .eq('user_id', filters.userId)
    .is('deleted_at', null)
    .order('transaction_date', { ascending: false })
    .range(start, end);

  if (filters.accountIds && filters.accountIds.length > 0) {
    countQuery = countQuery.in('account_id', filters.accountIds);
    dataQuery = dataQuery.in('account_id', filters.accountIds);
  }

  if (filters.startDate) {
    countQuery = countQuery.gte('transaction_date', filters.startDate);
    dataQuery = dataQuery.gte('transaction_date', filters.startDate);
  }

  if (filters.endDate) {
    countQuery = countQuery.lte('transaction_date', filters.endDate);
    dataQuery = dataQuery.lte('transaction_date', filters.endDate);
  }

  if (filters.type) {
    countQuery = countQuery.eq('type', filters.type);
    dataQuery = dataQuery.eq('type', filters.type);
  }

  if (filters.categories && filters.categories.length > 0) {
    countQuery = countQuery.in('category', filters.categories);
    dataQuery = dataQuery.in('category', filters.categories);
  }

  if (filters.supplierId) {
    countQuery = countQuery.eq('supplier_id', filters.supplierId);
    dataQuery = dataQuery.eq('supplier_id', filters.supplierId);
  }

  if (filters.searchTerm && filters.searchTerm.trim() !== '') {
    const trimmedSearch = filters.searchTerm.trim();
    countQuery = countQuery.ilike('description', `%${trimmedSearch}%`);
    dataQuery = dataQuery.ilike('description', `%${trimmedSearch}%`);
  }

  if (filters.includeProjected === false) {
    countQuery = countQuery.eq('is_projected', false);
    dataQuery = dataQuery.eq('is_projected', false);
  }

  if (filters.isRecurring !== undefined) {
    countQuery = countQuery.eq('is_recurring', filters.isRecurring);
    dataQuery = dataQuery.eq('is_recurring', filters.isRecurring);
  }

  if (filters.isTransfer !== undefined) {
    countQuery = countQuery.eq('is_transfer', filters.isTransfer);
    dataQuery = dataQuery.eq('is_transfer', filters.isTransfer);
  }

  if (filters.minAmount !== undefined) {
    countQuery = countQuery.gte('amount', filters.minAmount);
    dataQuery = dataQuery.gte('amount', filters.minAmount);
  }

  if (filters.maxAmount !== undefined) {
    countQuery = countQuery.lte('amount', filters.maxAmount);
    dataQuery = dataQuery.lte('amount', filters.maxAmount);
  }

  const [countResult, dataResult] = await Promise.all([
    countQuery,
    dataQuery
  ]);

  if (dataResult.error) {
    throw new Error(dataResult.error.message);
  }

  return {
    transactions: (dataResult.data as TransactionWithAccount[]) || [],
    totalCount: countResult.count || 0,
  };
}

export function useTransactions(filters: TransactionFilters) {
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => fetchTransactions(filters),
    enabled: !!filters.userId,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transactionId: string) => {
      const { error } = await supabase
        .from('transactions')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', transactionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transaction: Omit<Transaction, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>) => {
      const { data, error } = await supabase
        .from('transactions')
        .insert(transaction)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Transaction> }) => {
      const { data, error } = await supabase
        .from('transactions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}
