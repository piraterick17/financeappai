import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

interface Transaction {
  type: 'income' | 'expense';
  amount: number;
  transaction_date: string;
  is_transfer?: boolean;
}

export interface MonthlyData {
  name: string;
  ingresos: number;
  gastos: number;
  neto: number;
  month: string;
}

export function getLast6MonthsRange(): { start: string; end: string } {
  const now = new Date();
  const startDate = startOfMonth(subMonths(now, 5));
  const endDate = endOfMonth(now);

  return {
    start: format(startDate, 'yyyy-MM-dd'),
    end: format(endDate, 'yyyy-MM-dd'),
  };
}

export function processTransactionsBy6Months(transactions: Transaction[]): MonthlyData[] {
  const now = new Date();
  const monthlyDataMap = new Map<string, MonthlyData>();

  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  for (let i = 5; i >= 0; i--) {
    const monthDate = subMonths(now, i);
    const monthKey = format(monthDate, 'yyyy-MM');
    const monthIndex = monthDate.getMonth();
    const capitalizedName = monthNames[monthIndex];

    monthlyDataMap.set(monthKey, {
      name: capitalizedName,
      ingresos: 0,
      gastos: 0,
      neto: 0,
      month: monthKey,
    });
  }

  transactions.forEach((transaction) => {
    if (transaction.is_transfer) return;
    if (!transaction.transaction_date) return;

    const transactionMonth = transaction.transaction_date.substring(0, 7);
    const monthData = monthlyDataMap.get(transactionMonth);

    if (monthData) {
      const amount = Math.abs(Number(transaction.amount));

      if (transaction.type === 'income') {
        monthData.ingresos += amount;
      } else if (transaction.type === 'expense') {
        monthData.gastos += amount;
      }
    }
  });

  const result = Array.from(monthlyDataMap.values());

  result.forEach((month) => {
    month.neto = month.ingresos - month.gastos;
  });

  return result;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
