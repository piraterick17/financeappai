import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';

type FixedExpense = Database['public']['Tables']['fixed_expenses']['Row'];
type Transaction = Database['public']['Tables']['transactions']['Row'];

/**
 * Determines if a subscription should generate a transaction this month
 * based on its frequency (monthly, annual, biweekly, etc.)
 */
function shouldGenerateThisMonth(sub: FixedExpense, currentYear: number, currentMonth: number): boolean {
    const frequency = (sub.frequency || 'monthly').toLowerCase();
    const startDate = new Date(sub.start_date + 'T12:00:00');
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth(); // 0-indexed

    switch (frequency) {
        case 'monthly':
            return true;

        case 'annual':
        case 'yearly':
            // Only generate in the same month as start_date
            return currentMonth === startMonth;

        case 'biweekly':
        case 'quincenal':
            // Biweekly: always generate (twice per month on due_day and due_day+15)
            return true;

        case 'quarterly':
        case 'trimestral':
            // Every 3 months from start
            const monthsSinceStartQ = (currentYear - startYear) * 12 + (currentMonth - startMonth);
            return monthsSinceStartQ >= 0 && monthsSinceStartQ % 3 === 0;

        case 'bimonthly':
        case 'bimestral':
            // Every 2 months from start
            const monthsSinceStartB = (currentYear - startYear) * 12 + (currentMonth - startMonth);
            return monthsSinceStartB >= 0 && monthsSinceStartB % 2 === 0;

        case 'semiannual':
        case 'semestral':
            // Every 6 months from start
            const monthsSinceStartS = (currentYear - startYear) * 12 + (currentMonth - startMonth);
            return monthsSinceStartS >= 0 && monthsSinceStartS % 6 === 0;

        default:
            // Unknown frequency — default to monthly
            return true;
    }
}

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

        // 2. Get all transactions for the current month (excluding soft-deleted)
        const startOfMonth = new Date(currentYear, currentMonth, 1).toISOString();
        const endOfMonth = new Date(currentYear, currentMonth + 1, 0).toISOString();

        const { data: transactionsData, error: transError } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', userId)
            .is('deleted_at', null)
            .gte('transaction_date', startOfMonth)
            .lte('transaction_date', endOfMonth);

        if (transError) throw transError;

        const existingTransactions = (transactionsData || []) as Transaction[];
        const transactionsToCreate: any[] = [];

        // 3. Check which subscriptions need a transaction generated
        for (const sub of subscriptions) {
            // Check if this subscription should fire this month based on frequency
            if (!shouldGenerateThisMonth(sub, currentYear, currentMonth)) {
                continue;
            }

            // Handle due_day > days in month (e.g. 31st in Feb)
            const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
            const day = Math.min(sub.due_day, daysInMonth);

            const targetDate = new Date(currentYear, currentMonth, day);
            const formattedDate = targetDate.toISOString().split('T')[0];

            // Check for duplicates (Fuzzy match)
            const isDuplicate = existingTransactions.some(t => {
                const nameMatch = t.description.toLowerCase().includes(sub.name.toLowerCase()) ||
                    sub.name.toLowerCase().includes(t.description.toLowerCase());
                const amountMatch = Math.abs(Math.abs(t.amount) - Math.abs(sub.amount)) < 1;
                return nameMatch && amountMatch;
            });

            if (!isDuplicate) {
                transactionsToCreate.push({
                    user_id: userId,
                    account_id: sub.account_id,
                    category_id: sub.category_id,
                    description: sub.name,
                    amount: -Math.abs(sub.amount),
                    type: 'expense',
                    transaction_date: formattedDate,
                    is_recurring: true,
                    recurrence_period: sub.frequency || 'monthly',
                    is_projected: targetDate > today,
                    category: null,
                });
            }
        }

        // 4. Batch insert new transactions
        if (transactionsToCreate.length > 0) {
            // Look up category names
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
