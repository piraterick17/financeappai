import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';
import { format, addMonths, startOfMonth, endOfMonth, differenceInMonths } from 'date-fns';
import { es } from 'date-fns/locale';

type Transaction = Database['public']['Tables']['transactions']['Row'];
type FixedExpense = Database['public']['Tables']['fixed_expenses']['Row'];
type CreditPurchase = Database['public']['Tables']['credit_purchases']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];

export interface MonthColumn {
    key: string;        // 'yyyy-MM'
    label: string;      // 'FEBRERO'
    year: string;       // '2026'
    isPast: boolean;
    isCurrent: boolean;
}

export interface ForecastRow {
    id: string; // unique key for React
    originalId: string; // The identifier for updates (UUID or Description)
    name: string; // Display name (Description or Item Name)
    icon?: string;
    amounts: Record<string, number>; // key = 'yyyy-MM', value = amount
    source: 'transaction' | 'fixed_expense' | 'credit_purchase';
    categoryName?: string; // The assigned Category logic uses this to group
    categoryId?: string | null; // The assigned Category ID
    rowType?: 'income' | 'expense';
}

export interface CategoryGroup {
    name: string;
    type: 'income' | 'expense';
    color: string;
    rows: ForecastRow[];
    hasProperCategory: boolean;
}

export interface ForecastTableData {
    months: MonthColumn[];
    groups: CategoryGroup[];
    monthlyTotals: Record<string, number>;
    monthlyIncome: Record<string, number>;
}

export interface UseForecastTableOptions {
    userId: string | undefined;
    startMonth: string;
    endMonth: string;
    selectedAccounts?: string[];
}

async function fetchForecastTableData(
    userId: string,
    startMonthStr: string,
    endMonthStr: string,
    selectedAccounts: string[]
): Promise<ForecastTableData> {
    const now = new Date();
    const currentMonthStart = startOfMonth(now);

    const rangeStart = new Date(startMonthStr + '-01');
    const rangeEndMonth = new Date(endMonthStr + '-01');
    const rangeEnd = endOfMonth(rangeEndMonth);

    const totalMonths = differenceInMonths(rangeEndMonth, rangeStart) + 1;

    const months: MonthColumn[] = [];
    for (let i = 0; i < totalMonths; i++) {
        const monthDate = addMonths(rangeStart, i);
        const key = format(monthDate, 'yyyy-MM');
        months.push({
            key,
            label: format(monthDate, 'MMMM', { locale: es }).toUpperCase(),
            year: format(monthDate, 'yyyy'),
            isPast: monthDate < currentMonthStart,
            isCurrent: format(monthDate, 'yyyy-MM') === format(now, 'yyyy-MM'),
        });
    }

    const [transactionsRes, fixedExpensesRes, creditPurchasesRes, categoriesRes] =
        await Promise.all([
            supabase
                .from('transactions')
                .select('*')
                .eq('user_id', userId)
                .is('deleted_at', null)
                .gte('transaction_date', format(rangeStart, 'yyyy-MM-dd'))
                .lte('transaction_date', format(rangeEnd, 'yyyy-MM-dd')),
            supabase
                .from('fixed_expenses')
                .select('*')
                .eq('user_id', userId)
                .eq('is_active', true)
                .neq('id', null as any),
            supabase
                .from('credit_purchases')
                .select('*')
                .eq('user_id', userId)
                .eq('is_active', true)
                .neq('id', null as any),
            supabase
                .from('categories')
                .select('*')
                .eq('user_id', userId)
                .is('deleted_at', null),
        ]);

    const transactions = ((transactionsRes.data || []) as Transaction[]).filter(
        (t) => (selectedAccounts.length === 0 || selectedAccounts.includes(t.account_id)) && !!t.id
    );
    const fixedExpenses = ((fixedExpensesRes.data || []) as FixedExpense[]).filter(
        (f) => (selectedAccounts.length === 0 || selectedAccounts.includes(f.account_id)) && !!f.id
    );
    const creditPurchases = ((creditPurchasesRes.data || []) as CreditPurchase[]).filter(
        (c) => (selectedAccounts.length === 0 || selectedAccounts.includes(c.account_id)) && !!c.id
    );
    const categories = (categoriesRes.data || []) as Category[];

    const categoryMap = new Map<string, { name: string; type: 'income' | 'expense'; color: string }>();
    categories.forEach((c) => {
        categoryMap.set(c.name, { name: c.name, type: c.type, color: c.color });
    });

    const categoryNameSet = new Set(categories.map(c => c.name));

    // --- Aggregate actual transactions by Category AND Normalized Description per month ---
    const transactionsByCatDescMonth = new Map<string, Map<string, Map<string, number>>>();
    const transactionTypeMap = new Map<string, 'income' | 'expense'>(); // Map Description -> Type
    const recurringDescriptions = new Set<string>();

    transactions.forEach((t) => {
        if ((t as any).is_transfer) return;

        // Grouping by Category Name first (group container)
        const catName = t.category || 'Sin Categoría';

        // Normalize Description: Remove installment counts like "(1/12)"
        const originalDesc = t.description || 'Desconocido';
        const isInstallment = /\(\d+\/\d+\)/.test(originalDesc);

        let descName = originalDesc.replace(/\s*\(\d+\/\d+\).*/, '').trim();
        if (!descName) descName = 'Desconocido';

        if (t.is_recurring || isInstallment) {
            recurringDescriptions.add(descName);
        }

        const monthKey = t.transaction_date.substring(0, 7);

        if (!transactionsByCatDescMonth.has(catName)) {
            transactionsByCatDescMonth.set(catName, new Map());
        }
        const catMap = transactionsByCatDescMonth.get(catName)!;

        if (!catMap.has(descName)) {
            catMap.set(descName, new Map());
        }
        const descMap = catMap.get(descName)!;

        descMap.set(monthKey, (descMap.get(monthKey) || 0) + Math.abs(Number(t.amount)));

        transactionTypeMap.set(descName, t.type);
    });

    // --- Project Fixed Expenses ---
    const fixedExpenseRows: ForecastRow[] = fixedExpenses.map((fe) => {
        const amounts: Record<string, number> = {};

        months.forEach((m) => {
            const monthDate = new Date(m.key + '-01');
            const startDate = new Date(fe.start_date);
            const endDate = fe.end_date ? new Date(fe.end_date) : null;

            if (monthDate >= startOfMonth(startDate) && (!endDate || monthDate <= endOfMonth(endDate))) {
                let actualAmount: number | undefined;

                // Strategy: Look for transaction description matching FE name
                for (const [_, descMap] of transactionsByCatDescMonth) {
                    // FE name might also need normalization? Assuming FE name matches user intent (normalized).
                    // But if FE check matches "Netflix", and transaction is "Netflix (July)", normalized transaction is "Netflix".
                    // So we check for exact match against normalized description.
                    if (descMap.has(fe.name)) {
                        const amt = descMap.get(fe.name)?.get(m.key);
                        if (amt !== undefined) {
                            actualAmount = (actualAmount || 0) + amt;
                        }
                    }
                }

                if (actualAmount !== undefined) {
                    amounts[m.key] = actualAmount;
                } else if (!m.isPast) {
                    amounts[m.key] = Number(fe.amount);
                }
            }
        });

        return {
            id: `fe-${fe.id}`,
            originalId: fe.id,
            name: fe.name,
            amounts,
            source: 'fixed_expense' as const,
            categoryName: fe.name, // Fallback logic will assign group
            categoryId: fe.category_id,
            rowType: 'expense' as const,
        };
    });

    // --- Project Credit Purchases ---
    const creditPurchaseRows: ForecastRow[] = creditPurchases
        .filter(cp => !!cp.id)
        .map((cp) => {
            const amounts: Record<string, number> = {};
            const firstPayment = startOfMonth(new Date(cp.first_payment_date));

            months.forEach((m) => {
                const monthDate = new Date(m.key + '-01');

                let actualAmount: number | undefined;

                // Look for transaction description matching CP description (normalized)
                for (const [_, descMap] of transactionsByCatDescMonth) {
                    if (descMap.has(cp.description)) {
                        const amt = descMap.get(cp.description)?.get(m.key);
                        if (amt !== undefined) {
                            actualAmount = (actualAmount || 0) + amt;
                        }
                    }
                }

                if (actualAmount !== undefined) {
                    amounts[m.key] = actualAmount;
                } else {
                    const monthsDiff = Math.round(
                        (monthDate.getTime() - firstPayment.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
                    );

                    if (monthsDiff >= 0 && monthsDiff < cp.installments) {
                        amounts[m.key] = Number(cp.installment_amount);
                    }
                }
            });

            return {
                id: `cp-${cp.id}`,
                originalId: cp.id,
                name: cp.description,
                amounts,
                source: 'credit_purchase' as const,
                categoryName: cp.description,
                categoryId: cp.category_id,
                rowType: 'expense' as const,
            };
        });

    // --- Build Transaction Rows ---
    const coveredNames = new Set([
        ...fixedExpenses.map((f) => f.name),
        ...creditPurchases.map((c) => c.description),
    ]);

    const transactionRows: ForecastRow[] = [];

    transactionsByCatDescMonth.forEach((descMap, catName) => {
        descMap.forEach((monthMap, descName) => {
            if (coveredNames.has(descName)) return;

            // NEW: Filter out non-recurring transactions
            // If it's not a known Fixed Expense/Credit Purchase (coveredNames)
            // AND it wasn't flagged as recurring in the transactions scan
            if (!recurringDescriptions.has(descName)) {
                return;
            }

            const amounts: Record<string, number> = {};
            monthMap.forEach((val, key) => {
                amounts[key] = val;
            });

            transactionRows.push({
                id: `tx-${descName}-${catName}`,
                originalId: descName, // Normalized Description
                name: descName,
                amounts,
                source: 'transaction' as const,
                categoryName: catName,
                rowType: transactionTypeMap.get(descName) || 'expense',
            });
        });
    });

    // --- Grouping Logic ---
    const groupsMap = new Map<string, CategoryGroup>();

    const assignToGroup = (row: ForecastRow, groupCatName: string) => {
        const catInfo = categoryMap.get(groupCatName);
        const groupType = catInfo?.type || 'expense';
        const groupColor = catInfo?.color || '#6B7280';
        const hasProperCategory = categoryNameSet.has(groupCatName);

        let groupKey: string;
        if (groupType === 'income') {
            groupKey = 'Ingresos';
        } else {
            groupKey = groupCatName;
        }

        if (!groupsMap.has(groupKey)) {
            groupsMap.set(groupKey, {
                name: groupKey,
                type: groupType,
                color: groupColor,
                rows: [],
                hasProperCategory: groupType === 'income' ? true : hasProperCategory,
            });
        }
        groupsMap.get(groupKey)!.rows.push(row);
    };

    fixedExpenseRows.forEach((row) => {
        const fe = fixedExpenses.find((f) => `fe-${f.id}` === row.id);
        const cat = fe ? categories.find((c) => c.id === fe.category_id) : null;
        assignToGroup(row, cat?.name || row.name);
    });

    creditPurchaseRows.forEach((row) => {
        const cp = creditPurchases.find((c) => `cp-${c.id}` === row.id);
        const cat = cp ? categories.find((c) => c.id === cp.category_id) : null;
        assignToGroup(row, cat?.name || row.name);
    });

    transactionRows.forEach((row) => {
        assignToGroup(row, row.categoryName || 'Sin Categoría');
    });

    // Consolidation Logic
    const consolidatedGroups: CategoryGroup[] = [];
    groupsMap.forEach((group) => {
        const mergedRows = new Map<string, ForecastRow>();
        group.rows.forEach((row) => {
            if (mergedRows.has(row.name)) {
                const existing = mergedRows.get(row.name)!;
                Object.entries(row.amounts).forEach(([key, val]) => {
                    existing.amounts[key] = (existing.amounts[key] || 0) + val;
                });
            } else {
                mergedRows.set(row.name, { ...row, amounts: { ...row.amounts } });
            }
        });

        // Sort rows alphabetically or by amount?
        // Let's sort alphabetically for stability
        const finalRows = Array.from(mergedRows.values()).sort((a, b) => a.name.localeCompare(b.name));

        consolidatedGroups.push({
            ...group,
            rows: finalRows,
        });
    });

    const incomeGroups = consolidatedGroups.filter((g) => g.type === 'income');
    const expenseGroups = consolidatedGroups.filter((g) => g.type === 'expense');
    // Sort groups: Income first? No expense first usually.
    // Sort expense groups alphabetically?
    expenseGroups.sort((a, b) => a.name.localeCompare(b.name));

    const sortedGroups = [...expenseGroups, ...incomeGroups];

    const monthlyTotals: Record<string, number> = {};
    const monthlyIncome: Record<string, number> = {};

    months.forEach((m) => {
        monthlyTotals[m.key] = 0;
        monthlyIncome[m.key] = 0;
    });

    sortedGroups.forEach((group) => {
        group.rows.forEach((row) => {
            months.forEach((m) => {
                const amt = row.amounts[m.key] || 0;
                if (group.type === 'expense') {
                    monthlyTotals[m.key] += amt;
                } else {
                    monthlyIncome[m.key] += amt;
                }
            });
        });
    });

    return {
        months,
        groups: sortedGroups,
        monthlyTotals,
        monthlyIncome,
    };
}

export function useForecastTable(options: UseForecastTableOptions) {
    const { userId, startMonth, endMonth, selectedAccounts = [] } = options;

    return useQuery({
        queryKey: ['forecast-table', userId, startMonth, endMonth, selectedAccounts],
        queryFn: () => fetchForecastTableData(userId!, startMonth, endMonth, selectedAccounts),
        enabled: !!userId,
        staleTime: 2 * 60 * 1000,
        gcTime: 5 * 60 * 1000,
    });
}
