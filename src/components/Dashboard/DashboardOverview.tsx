import { useEffect, useState } from 'react';
import { Wallet, TrendingUp, TrendingDown, CreditCard } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { FinancialTrendChart } from './FinancialTrendChart';
import { AccountsDetailModal } from './AccountsDetailModal';
import { Database } from '../../lib/database.types';
import {
  getLast6MonthsRange,
  processTransactionsBy6Months,
  MonthlyData,
} from '../../utils/financialDataProcessing';

import { processSubscriptions } from '../../utils/subscriptionProcessor';

type Account = Database['public']['Tables']['accounts']['Row'];

interface SummaryData {
  totalBalance: number;
  totalLiquidity: number;
  totalDebt: number;
  netWorth: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  activeAccounts: number;
  projectedEndOfMonthBalance: number;
}

export function DashboardOverview() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedCard, setSelectedCard] = useState<'netWorth' | 'liquid' | 'credit' | 'all' | null>(null);
  const [summary, setSummary] = useState<SummaryData>({
    totalBalance: 0,
    totalLiquidity: 0,
    totalDebt: 0,
    netWorth: 0,
    monthlyIncome: 0,
    monthlyExpenses: 0,
    activeAccounts: 0,
    projectedEndOfMonthBalance: 0,
  });
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      checkAndRealizePendingTransactions();
      processSubscriptions(user.id).then(() => {
        // Reload summary after processing subscriptions to reflect changes
        loadSummary();
      });
    }
  }, [user]);

  const checkAndRealizePendingTransactions = async () => {
    if (!user) return;

    try {
      const { data: rpcResult } = await supabase.rpc(
        'check_and_realize_projected_transactions'
      );

      if (rpcResult?.realized_count > 0) {
        console.log(`${rpcResult.realized_count} cuotas aplicadas automáticamente`);
      }
    } catch (error) {
      console.error('Error al verificar cuotas proyectadas:', error);
    }

    await loadSummary();
  };

  const loadSummary = async () => {
    if (!user) return;

    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const monthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const monthEnd = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];

    const { start: sixMonthsStart, end: sixMonthsEnd } = getLast6MonthsRange();

    const [fullAccountsRes, currentMonthTransactionsRes, projectedMonthTransactionsRes, sixMonthsTransactionsRes] = await Promise.all([
      supabase.from('accounts').select('*').eq('user_id', user.id).eq('is_active', true),
      supabase.from('accounts').select('balance, is_active, type').eq('user_id', user.id),
      supabase
        .from('transactions')
        .select('type, amount, is_transfer')
        .eq('user_id', user.id)
        .eq('is_projected', false)
        .is('deleted_at', null)
        .gte('transaction_date', monthStart)
        .lte('transaction_date', monthEnd),
      supabase
        .from('transactions')
        .select('type, amount, is_transfer')
        .eq('user_id', user.id)
        .eq('is_projected', true)
        .is('deleted_at', null)
        .gte('transaction_date', monthStart)
        .lte('transaction_date', monthEnd),
      supabase
        .from('transactions')
        .select('type, amount, transaction_date, is_transfer')
        .eq('user_id', user.id)
        .eq('is_projected', false)
        .is('deleted_at', null)
        .gte('transaction_date', sixMonthsStart)
        .lte('transaction_date', sixMonthsEnd)
        .order('transaction_date', { ascending: true }),
    ]);

    if (fullAccountsRes.data) {
      setAccounts(fullAccountsRes.data);
    }

    const accountsRes = fullAccountsRes;

    const totalLiquidity = accountsRes.data
      ?.filter((acc) => acc.type !== 'credit')
      .reduce((sum, acc) => sum + Number(acc.balance), 0) || 0;

    const totalDebt = Math.abs(
      accountsRes.data
        ?.filter((acc) => acc.type === 'credit')
        .reduce((sum, acc) => sum + Number((acc as any).balance || 0), 0) || 0
    );

    const netWorth = totalLiquidity - totalDebt;
    const totalBalance = accountsRes.data?.reduce((sum, acc) => sum + Number(acc.balance), 0) || 0;
    const activeAccounts = accountsRes.data?.filter((acc) => acc.is_active).length || 0;

    const monthlyIncome =
      currentMonthTransactionsRes.data
        ?.filter((t) => t.type === 'income' && !t.is_transfer && !t.is_projected)
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

    const monthlyExpenses =
      currentMonthTransactionsRes.data
        ?.filter((t) => t.type === 'expense' && !t.is_transfer && !t.is_projected)
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

    const projectedIncome =
      projectedMonthTransactionsRes.data
        ?.filter((t) => t.type === 'income' && !t.is_transfer)
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

    const projectedExpenses =
      projectedMonthTransactionsRes.data
        ?.filter((t) => t.type === 'expense' && !t.is_transfer)
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

    const projectedEndOfMonthBalance = totalLiquidity + projectedIncome + projectedExpenses;

    const processedMonthlyData = processTransactionsBy6Months(
      (sixMonthsTransactionsRes.data || []) as any[]
    );
    setMonthlyData(processedMonthlyData);

    setSummary({
      totalBalance,
      totalLiquidity,
      totalDebt,
      netWorth,
      monthlyIncome,
      monthlyExpenses,
      activeAccounts,
      projectedEndOfMonthBalance,
    });

    setLoading(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  const getCardData = (filterType: 'netWorth' | 'liquid' | 'credit' | 'all') => {
    const modalTitles = {
      netWorth: 'Patrimonio Neto',
      liquid: 'Liquidez Total',
      credit: 'Deuda Total',
      all: 'Balance Consolidado',
    };
    const modalDescriptions = {
      netWorth: 'Liquidez total menos deuda total',
      liquid: 'Cuentas de débito y ahorro',
      credit: 'Tarjetas de crédito',
      all: 'Todas las cuentas activas',
    };
    return {
      title: modalTitles[filterType],
      description: modalDescriptions[filterType],
    };
  };

  const cards = [
    {
      title: 'Patrimonio Neto',
      value: formatCurrency(summary.netWorth),
      icon: Wallet,
      color: summary.netWorth >= 0 ? 'bg-green-500' : 'bg-red-500',
      description: 'Liquidez - Deuda',
      filterType: 'netWorth' as const,
    },
    {
      title: 'Liquidez Total',
      value: formatCurrency(summary.totalLiquidity),
      icon: TrendingUp,
      color: 'bg-blue-500',
      description: 'Efectivo disponible',
      filterType: 'liquid' as const,
    },
    {
      title: 'Deuda Total',
      value: formatCurrency(summary.totalDebt),
      icon: CreditCard,
      color: 'bg-orange-500',
      description: 'Saldo a pagar en créditos',
      filterType: 'credit' as const,
    },
    {
      title: 'Balance Consolidado',
      value: formatCurrency(summary.totalBalance),
      icon: Wallet,
      color: 'bg-purple-500',
      description: 'Suma de todas las cuentas',
      filterType: 'all' as const,
    },
  ];

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6 lg:p-8">
        <h2 className="text-xl sm:text-2xl font-bold text-text-main">Panel de Control</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-surface rounded-xl p-4 sm:p-6 shadow-sm animate-pulse">
              <div className="h-4 bg-surface/50 rounded w-24 mb-4"></div>
              <div className="h-8 bg-surface/50 rounded w-32"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6 lg:p-8">
      <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-text-main">Panel de Control</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              onClick={() => setSelectedCard(card.filterType)}
              className="cursor-pointer transition-transform hover:scale-105 bg-surface border border-border rounded-xl p-4 sm:p-6 shadow-sm hover:shadow-md"
            >
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-text-muted">{card.title}</p>
                  {(card as any).description && (
                    <p className="text-xs text-text-muted/70 mt-1">{(card as any).description}</p>
                  )}
                </div>
                <div className={`${card.color} p-2 rounded-lg`}>
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-text-main">{card.value}</p>
            </div>
          );
        })}
      </div>

      <FinancialTrendChart data={monthlyData} loading={loading} />

      <div className="bg-surface border border-border rounded-xl p-4 sm:p-6 shadow-sm">
        <h3 className="text-base sm:text-lg font-semibold text-text-main mb-3 sm:mb-4">Balance Mensual</h3>
        <div className="space-y-2 sm:space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm sm:text-base text-text-muted">Ingresos</span>
            <span className="text-sm sm:text-base text-green-500 font-semibold">
              {formatCurrency(summary.monthlyIncome)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm sm:text-base text-text-muted">Gastos</span>
            <span className="text-sm sm:text-base text-red-500 font-semibold">
              {formatCurrency(summary.monthlyExpenses)}
            </span>
          </div>
          <div className="border-t border-border pt-2 sm:pt-3 flex justify-between items-center">
            <span className="text-sm sm:text-base font-semibold text-text-main">Neto</span>
            <span
              className={`text-sm sm:text-base font-bold ${summary.monthlyIncome - summary.monthlyExpenses >= 0
                ? 'text-green-500'
                : 'text-red-500'
                }`}
            >
              {formatCurrency(summary.monthlyIncome - summary.monthlyExpenses)}
            </span>
          </div>
          <div className="border-t border-border/50 pt-2 sm:pt-3 mt-2 sm:mt-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm text-text-muted/80">Proyectado al cierre</span>
                <span className="text-xs text-text-muted/60" title="Incluye pagos e ingresos pendientes del mes">⏱️</span>
              </div>
              <span
                className={`text-xs sm:text-sm font-semibold ${summary.projectedEndOfMonthBalance >= 0
                  ? 'text-blue-400'
                  : 'text-orange-400'
                  }`}
              >
                {formatCurrency(summary.projectedEndOfMonthBalance)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {selectedCard && (
        <AccountsDetailModal
          title={getCardData(selectedCard).title}
          description={getCardData(selectedCard).description}
          accounts={accounts}
          filterType={selectedCard}
          onClose={() => setSelectedCard(null)}
        />
      )}
    </div>
  );
}
