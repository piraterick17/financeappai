import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';

type Account = Database['public']['Tables']['accounts']['Row'];

async function fetchAccounts(userId: string): Promise<Account[]> {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('name');

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export function useAccounts(userId: string | undefined) {
  return useQuery({
    queryKey: ['accounts', userId],
    queryFn: () => fetchAccounts(userId!),
    enabled: !!userId,
  });
}
