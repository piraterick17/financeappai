import { TrendingUp, TrendingDown, DollarSign, Hash, ArrowUpDown } from 'lucide-react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface TransactionsSummaryProps {
  totalIncome: number;
  totalExpenses: number;
  transactionCount: number;
  averageTransaction: number;
  largestExpense: number;
  largestIncome: number;
  dailyData: Array<{ date: string; balance: number }>;
}

export function TransactionsSummary({
  totalIncome,
  totalExpenses,
  transactionCount,
  averageTransaction,
  largestExpense,
  largestIncome,
  dailyData,
}: TransactionsSummaryProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const netBalance = totalIncome - totalExpenses;

  return (
    <div className="bg-surface rounded-xl border border-border p-4 sm:p-6 space-y-4 sm:space-y-6">
      <h3 className="text-lg font-bold text-text-main">Resumen del Período</h3>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-background rounded-lg p-4 border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-text-muted uppercase">Ingresos</span>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-green-500">{formatCurrency(totalIncome)}</p>
        </div>

        <div className="bg-background rounded-lg p-4 border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-text-muted uppercase">Gastos</span>
            <TrendingDown className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-500">{formatCurrency(totalExpenses)}</p>
        </div>

        <div className="bg-background rounded-lg p-4 border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-text-muted uppercase">Balance Neto</span>
            <DollarSign className={`w-4 h-4 ${netBalance >= 0 ? 'text-primary' : 'text-orange-500'}`} />
          </div>
          <p className={`text-2xl font-bold ${netBalance >= 0 ? 'text-primary' : 'text-orange-500'}`}>
            {formatCurrency(netBalance)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-background/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Hash className="w-3 h-3 text-text-muted" />
            <span className="text-[10px] font-medium text-text-muted uppercase">Transacciones</span>
          </div>
          <p className="text-lg font-bold text-text-main">{transactionCount}</p>
        </div>

        <div className="bg-background/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <ArrowUpDown className="w-3 h-3 text-text-muted" />
            <span className="text-[10px] font-medium text-text-muted uppercase">Promedio</span>
          </div>
          <p className="text-lg font-bold text-text-main">{formatCurrency(averageTransaction)}</p>
        </div>

        <div className="bg-background/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-3 h-3 text-green-500" />
            <span className="text-[10px] font-medium text-text-muted uppercase">Mayor Ingreso</span>
          </div>
          <p className="text-lg font-bold text-green-500">{formatCurrency(largestIncome)}</p>
        </div>

        <div className="bg-background/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-3 h-3 text-red-500" />
            <span className="text-[10px] font-medium text-text-muted uppercase">Mayor Gasto</span>
          </div>
          <p className="text-lg font-bold text-red-500">{formatCurrency(Math.abs(largestExpense))}</p>
        </div>
      </div>

      {dailyData.length > 1 && (
        <div className="pt-4 border-t border-border">
          <h4 className="text-sm font-semibold text-text-main mb-3">Tendencia de Balance</h4>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={dailyData}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#666' }}
                stroke="#333"
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#666' }}
                stroke="#333"
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value: number) => [formatCurrency(value), 'Balance']}
              />
              <Line
                type="monotone"
                dataKey="balance"
                stroke="#11d452"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
