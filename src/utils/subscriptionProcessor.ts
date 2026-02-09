import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';

type FixedExpense = Database['public']['Tables']['fixed_expenses']['Row'];
type Transaction = Database['public']['Tables']['transactions']['Row'];

export async function processSubscriptions(userId: string) {
    try {
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth(); // 0-indexed

        // 1. Get all active fixed expenses (subscriptions)
        const { data: subscriptionsData, error: subError } = await supabase
            .from('fixed_expenses')
            .select('*')
            .eq('user_id', userId)
            .eq('is_active', true);

        if (subError) throw subError;
        if (!subscriptionsData || subscriptionsData.length === 0) return;

        const subscriptions = subscriptionsData as FixedExpense[];

        // 2. Get all transactions for the current month
        const startOfMonth = new Date(currentYear, currentMonth, 1).toISOString();
        const endOfMonth = new Date(currentYear, currentMonth + 1, 0).toISOString();

        const { data: transactionsData, error: transError } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', userId)
            .gte('transaction_date', startOfMonth)
            .lte('transaction_date', endOfMonth);

        if (transError) throw transError;

        const existingTransactions = (transactionsData || []) as Transaction[];
        const transactionsToCreate: any[] = [];

        // 3. Check which subscriptions need a transaction generated
        for (const sub of subscriptions) {
            // Logic to determine date for this month
            // Handle due_day > days in month (e.g. 31st in Feb)
            const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
            const day = Math.min(sub.due_day, daysInMonth);

            const targetDate = new Date(currentYear, currentMonth, day);
            const formattedDate = targetDate.toISOString().split('T')[0];

            // Check for duplicates (Fuzzy match)
            const isDuplicate = existingTransactions.some(t => {
                // Match by exact name or description containing name
                const nameMatch = t.description.toLowerCase().includes(sub.name.toLowerCase()) ||
                    sub.name.toLowerCase().includes(t.description.toLowerCase());

                // Match by amount (within small margin or exact)
                const amountMatch = Math.abs(Math.abs(t.amount) - Math.abs(sub.amount)) < 1;

                return nameMatch && amountMatch;
            });

            if (!isDuplicate) {
                transactionsToCreate.push({
                    user_id: userId,
                    account_id: sub.account_id,
                    category_id: sub.category_id,
                    description: sub.name,
                    amount: -Math.abs(sub.amount), // Expenses are negative
                    type: 'expense',
                    transaction_date: formattedDate,
                    is_recurring: true,
                    recurrence_period: 'monthly',
                    is_projected: targetDate > today, // Projected if in the future
                    category: null // Categories usually joined, but we can try to set if we fetched it? 
                    // Actually category_id is enough for the DB, but UI might want category name. 
                    // The table definition has 'category' string field too? 
                    // Yes, 'category' column exists in transactions.
                });
            }
        }

        // 4. Batch insert new transactions
        if (transactionsToCreate.length > 0) {
            // Need to fetch category names for the text field if possible, 
            // but for now we'll leave 'category' null or let a trigger handle it if one exists.
            // Based on schema, 'category' is a string column. 
            // Ideally we would look up the category name from category_id.

            // Let's do a quick lookup if we have categories to create
            if (transactionsToCreate.some(t => t.category_id)) {
                const { data: categories } = await supabase
                    .from('categories')
                    .select('id, name')
                    .in('id', transactionsToCreate.map(t => t.category_id).filter(Boolean));

                if (categories) {
                    const catMap = new Map(categories.map(c => [c.id, c.name]));
                    transactionsToCreate.forEach(t => {
                        if (t.category_id && catMap.has(t.category_id)) {
                            t.category = catMap.get(t.category_id);
                        }
                    });
                }
            }

            const { error: insertError } = await supabase
                .from('transactions')
                .insert(transactionsToCreate);

            if (insertError) {
                console.error('Error batch creating subscription transactions:', insertError);
            } else {
                console.log(`Generated ${transactionsToCreate.length} subscription transactions.`);
            }
        }

    } catch (error) {
        console.error('Error processing subscriptions:', error);
    }
}
