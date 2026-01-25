import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';

type Category = Database['public']['Tables']['categories']['Row'];

async function fetchCategories(userId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('name', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export function useCategories(userId: string | undefined) {
  return useQuery({
    queryKey: ['categories', userId],
    queryFn: () => fetchCategories(userId!),
    enabled: !!userId,
  });
}
