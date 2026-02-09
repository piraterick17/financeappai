import { useMemo, useState } from 'react';
import { ArrowRightLeft, CreditCard, CheckCircle, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTransactions, useUpdateTransaction } from '../../hooks/useTransactions';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';

interface RecentTransactionsListProps {
    startDate: string;
    endDate: string;
}

export function RecentTransactionsList({ startDate, endDate }: RecentTransactionsListProps) {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'confirmed' | 'pending'>('confirmed');

    // Mutation for confirming transactions
    const updateTransaction = useUpdateTransaction();

    const { data: transactionsResponse, isLoading } = useTransactions({
        userId: user?.id || '',
        startDate,
        endDate,
        includeProjected: activeTab === 'confirmed' ? false : undefined, // specific logic below
        onlyProjected: activeTab === 'pending', // Use our new filter
        page: 1,
        itemsPerPage: 100,
    });

    const transactions = useMemo(() => transactionsResponse?.transactions || [], [transactionsResponse]);

    // Sort logic: Confirmed by date desc, Pending by date asc (upcoming first)
    const sortedTransactions = useMemo(() => {
        return [...transactions].sort((a, b) => {
            const dateA = new Date(a.transaction_date).getTime();
            const dateB = new Date(b.transaction_date).getTime();
            return activeTab === 'confirmed' ? dateB - dateA : dateA - dateB;
        });
    }, [transactions, activeTab]);

    const handleConfirm = async (transactionId: string) => {
        try {
            await updateTransaction.mutateAsync({
                id: transactionId,
                updates: { is_projected: false }
            });
            toast.success('Transacción confirmada');
        } catch (error) {
            toast.error('Error al confirmar transacción');
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
        }).format(amount);
    };

    const formatDate = (date: string) => {
        return new Date(date + 'T12:00:00').toLocaleDateString('es-MX', {
            day: 'numeric',
            month: 'short',
        });
    };

    if (isLoading) {
        return (
            <div className="bg-surface border border-border rounded-xl p-6 shadow-sm h-full">
                <h3 className="text-lg font-bold text-text-main mb-4">Cargando...</h3>
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-12 bg-surface/50 rounded animate-pulse"></div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-surface border border-border rounded-xl p-6 shadow-sm h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <div className="flex gap-2 bg-background/50 p-1 rounded-lg border border-border">
                    <button
                        onClick={() => setActiveTab('confirmed')}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${activeTab === 'confirmed'
                                ? 'bg-surface text-text-main shadow-sm'
                                : 'text-text-muted hover:text-text-main'
                            }`}
                    >
                        Confirmados
                    </button>
                    <button
                        onClick={() => setActiveTab('pending')}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${activeTab === 'pending'
                                ? 'bg-surface text-text-main shadow-sm'
                                : 'text-text-muted hover:text-text-main'
                            }`}
                    >
                        Pendientes
                    </button>
                </div>

                {activeTab === 'confirmed' && (
                    <Link to="/transactions/history" className="text-xs sm:text-sm text-primary hover:underline">
                        Ver historial
                    </Link>
                )}
            </div>

            <h3 className="text-lg font-bold text-text-main mb-4 flex items-center gap-2">
                {activeTab === 'confirmed' ? 'Movimientos Confirmados' : 'Próximos Movimientos'}
                <span className="text-xs font-normal text-text-muted">({transactions.length})</span>
            </h3>

            <div className="space-y-3 flex-1 overflow-y-auto max-h-[400px] pr-1 scrollbar-thin">
                {sortedTransactions.length === 0 ? (
                    <div className="text-center py-12 flex flex-col items-center">
                        <div className="w-12 h-12 bg-surface/50 rounded-full flex items-center justify-center mb-3">
                            {activeTab === 'confirmed' ? <Clock className="w-6 h-6 text-text-muted" /> : <CheckCircle className="w-6 h-6 text-text-muted" />}
                        </div>
                        <p className="text-text-muted">No hay movimientos {activeTab === 'confirmed' ? 'confirmados' : 'pendientes'} en este periodo</p>
                    </div>
                ) : (
                    sortedTransactions.map(t => {
                        const isIncome = t.type === 'income';
                        const amount = Number(t.amount);
                        const isPending = activeTab === 'pending';

                        return (
                            <div key={t.id} className="group flex items-center justify-between p-3 rounded-lg hover:bg-background/50 transition border border-transparent hover:border-border">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${t.is_transfer ? 'bg-blue-500/20 text-blue-400' :
                                        isIncome ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                        }`}>
                                        {t.is_transfer ? <ArrowRightLeft className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
                                    </div>
                                    <div>
                                        <p className="font-medium text-text-main text-sm">{t.description}</p>
                                        <p className="text-xs text-text-muted">
                                            {formatDate(t.transaction_date)} • {t.category || 'Sin categoría'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <p className={`font-bold text-sm ${t.is_transfer ? 'text-text-main' :
                                            isIncome ? 'text-green-500' : 'text-text-main'
                                            }`}>
                                            {t.is_transfer ? '' : (isIncome ? '+' : '')}
                                            {formatCurrency(Math.abs(amount))}
                                        </p>
                                        <p className="text-xs text-text-muted">{t.accounts?.name}</p>
                                    </div>

                                    {isPending && (
                                        <button
                                            onClick={() => handleConfirm(t.id)}
                                            className="p-2 text-text-muted hover:text-green-500 hover:bg-green-500/10 rounded-full transition"
                                            title="Confirmar transacción"
                                        >
                                            <CheckCircle className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
