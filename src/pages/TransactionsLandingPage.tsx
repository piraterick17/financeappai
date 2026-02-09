import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { History } from 'lucide-react';
import { TransactionForm } from '../components/Transactions/TransactionForm';
import { RecentTransactionsList } from '../components/Transactions/RecentTransactionsList';
import { ExpenseCategoryChart } from '../components/Transactions/ExpenseCategoryChart';
import { TransactionDateFilter } from '../components/Transactions/TransactionDateFilter';

export function TransactionsLandingPage() {
    const navigate = useNavigate();
    // Default to current month
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
    });

    const handleDateRangeChange = (start: string, end: string) => {
        setDateRange({ start, end });
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-text-main leading-tight">
                        Gestión de Transacciones
                    </h1>
                    <p className="text-text-muted mt-1">Registra y monitorea tus gastos diarios.</p>
                </div>
                <div className="flex items-center gap-2">
                    <TransactionDateFilter onRangeChange={handleDateRangeChange} />
                    <button
                        onClick={() => navigate('/dashboard/transactions/history')}
                        className="flex items-center gap-2 px-4 py-2 bg-surface border border-border text-text-main rounded-lg hover:bg-background transition font-medium text-sm"
                    >
                        <History className="w-4 h-4" />
                        <span className="hidden sm:inline">Historial Completo</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Input Form (Takes up 1 column on LG) */}
                <div className="lg:col-span-1 h-full">
                    <TransactionForm />
                </div>

                {/* Right Column: Insights & Recent (Takes up 2 columns on LG) */}
                <div className="lg:col-span-2 space-y-6 flex flex-col h-full">
                    {/* Top: Chart */}
                    <div className="flex-1 min-h-[300px]">
                        <ExpenseCategoryChart startDate={dateRange.start} endDate={dateRange.end} />
                    </div>

                    {/* Bottom: Recent List */}
                    <div className="flex-1">
                        <RecentTransactionsList startDate={dateRange.start} endDate={dateRange.end} />
                    </div>
                </div>
            </div>
        </div>
    );
}
