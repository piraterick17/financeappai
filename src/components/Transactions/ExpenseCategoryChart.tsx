import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { useTransactions } from '../../hooks/useTransactions';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

const COLORS = ['#11d452', '#00b4d8', '#ff9f1c', '#f72585', '#4361ee', '#7209b7', '#3f37c9', '#b5179e'];

interface ExpenseCategoryChartProps {
    startDate: string;
    endDate: string;
}

export function ExpenseCategoryChart({ startDate, endDate }: ExpenseCategoryChartProps) {
    const { user } = useAuth();

    const { data: transactionsResponse, isLoading } = useTransactions({
        userId: user?.id || '',
        startDate,
        endDate,
        itemsPerPage: 1000,
    });

    const { data: budgets } = useQuery({
        queryKey: ['budgets', user?.id],
        queryFn: async () => {
            const [budgetsRes, categoriesRes] = await Promise.all([
                supabase.from('category_budgets').select('*').eq('user_id', user?.id || ''),
                supabase.from('categories').select('*').eq('user_id', user?.id || '')
            ]);

            const excludeKeywords = ['deuda', 'fijo', 'tarjeta', 'crédito', 'ahorro', 'inversión'];

            // Explicitly cast or handle the data type to avoid 'never' inference
            const budgetsData = (budgetsRes.data || []) as any[];
            const categoriesData = (categoriesRes.data || []) as any[];

            const variableBudgets = budgetsData.filter(b => {
                const cat = categoriesData.find(c => c.id === b.category_id);
                if (!cat) return false;
                const catNameLower = cat.name.toLowerCase();
                return !excludeKeywords.some(keyword => catNameLower.includes(keyword));
            });

            return variableBudgets.reduce((sum, b) => sum + Number(b.amount), 0);
        },
        enabled: !!user?.id
    });

    const chartData = useMemo(() => {
        if (!transactionsResponse?.transactions) return [];

        const expensesByCategory: Record<string, number> = {};

        const excludeKeywords = ['deuda', 'fijo', 'tarjeta', 'crédito', 'ahorro', 'inversión'];

        transactionsResponse.transactions.forEach(t => {
            if (t.type === 'expense' && !t.is_transfer && t.category) {
                const catNameLower = t.category.toLowerCase();
                const isExcluded = excludeKeywords.some(keyword => catNameLower.includes(keyword));

                if (!isExcluded) {
                    const amount = Math.abs(Number(t.amount));
                    expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + amount;
                }
            }
        });

        return Object.entries(expensesByCategory)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8);
    }, [transactionsResponse]);

    const totalVariableExpenses = useMemo(() => {
        return chartData.reduce((sum, item) => sum + item.value, 0);
    }, [chartData]);

    const budgetStatusColor = useMemo(() => {
        if (!budgets) return 'text-text-muted';
        if (totalVariableExpenses > budgets) return 'text-red-500';
        if (totalVariableExpenses > budgets * 0.9) return 'text-orange-500';
        return 'text-green-500';
    }, [totalVariableExpenses, budgets]);

    if (isLoading) {
        return (
            <div className="bg-surface border border-border rounded-xl p-6 shadow-sm h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (chartData.length === 0) {
        return (
            <div className="bg-surface border border-border rounded-xl p-6 shadow-sm h-full flex flex-col items-center justify-center text-text-muted">
                <p>No hay gastos registrados este mes</p>
                {budgets && budgets > 0 && (
                    <p className="text-xs mt-2">
                        Presupuesto disponible: {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(budgets)}
                    </p>
                )}
            </div>
        );
    }

    return (
        <div className="bg-surface border border-border rounded-xl p-6 shadow-sm h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-lg font-bold text-text-main">
                        Gastos Variables <span className="text-xs font-normal text-text-muted">(Excl. fijos/deuda)</span>
                    </h3>
                    {budgets && budgets > 0 ? (
                        <p className="text-xs text-text-muted">
                            Meta: {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(budgets)}
                        </p>
                    ) : null}
                </div>
                <div className="text-right">
                    <span className={`text-sm font-bold block ${budgetStatusColor}`}>
                        {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(totalVariableExpenses)}
                    </span>
                    {budgets && budgets > 0 && (
                        <span className="text-xs text-text-muted">
                            {Math.round((totalVariableExpenses / budgets) * 100)}% usado
                        </span>
                    )}
                </div>
            </div>

            {budgets && budgets > 0 && (
                <div className="w-full h-2 bg-surface border border-border rounded-full mb-4 overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${totalVariableExpenses > budgets ? 'bg-red-500' : 'bg-primary'}`}
                        style={{ width: `${Math.min((totalVariableExpenses / budgets) * 100, 100)}%` }}
                    />
                </div>
            )}

            <div className="flex-1 w-full min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            formatter={(value: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value)}
                            contentStyle={{ backgroundColor: '#112217', borderColor: '#23482f', borderRadius: '8px', color: '#fff' }}
                            itemStyle={{ color: '#fff' }}
                        />
                        <Legend
                            layout="vertical"
                            verticalAlign="middle"
                            align="right"
                            wrapperStyle={{ fontSize: '12px' }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
