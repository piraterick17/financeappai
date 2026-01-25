import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';

type Supplier = Database['public']['Tables']['suppliers']['Row'];

export function useSuppliers(userId: string | undefined) {
  return useQuery({
    queryKey: ['suppliers', userId],
    queryFn: async () => {
      if (!userId) {
        return [];
      }

      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('name');

      if (error) {
        throw error;
      }

      return data as Supplier[];
    },
    enabled: !!userId,
  });
}
