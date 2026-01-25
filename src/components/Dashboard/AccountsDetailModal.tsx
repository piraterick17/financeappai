import { X } from 'lucide-react';
import { Database } from '../../lib/database.types';

type Account = Database['public']['Tables']['accounts']['Row'];

interface AccountsDetailModalProps {
  title: string;
  description: string;
  accounts: Account[];
  filterType?: 'all' | 'liquid' | 'credit' | 'netWorth';
  onClose: () => void;
}

export function AccountsDetailModal({
  title,
  description,
  accounts,
  filterType = 'all',
  onClose
}: AccountsDetailModalProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  const getAccountTypeLabel = (type: string) => {
    const labels = {
      credit: 'Tarjeta de Crédito',
      debit: 'Cuenta Corriente',
      savings: 'Cuenta de Ahorros',
      investment: 'Cuenta de Inversión',
    };
    return labels[type as keyof typeof labels] || type;
  };

  const filteredAccounts = accounts.filter(acc => {
    if (filterType === 'liquid') {
      return acc.type === 'debit' || acc.type === 'savings';
    }
    if (filterType === 'credit') {
      return acc.type === 'credit';
    }
    return true;
  });

  const calculateTotal = () => {
    return filteredAccounts.reduce((sum, acc) => {
      if (filterType === 'netWorth') {
        return sum + (acc.type === 'credit' ? -Number(acc.balance) : Number(acc.balance));
      }
      if (filterType === 'credit') {
        return sum + Math.abs(Number(acc.balance));
      }
      return sum + Number(acc.balance);
    }, 0);
  };

  const total = calculateTotal();

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-surface rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden border border-border shadow-2xl">
        <div className="flex justify-between items-center p-6 border-b border-border">
          <div>
            <h3 className="text-xl font-bold text-text-main">{title}</h3>
            <p className="text-sm text-text-muted mt-1">{description}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-background rounded-lg transition text-text-muted"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[60vh]">
          {filteredAccounts.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-text-muted">No hay cuentas para mostrar</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-background/50 sticky top-0">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-bold text-text-muted uppercase tracking-wider">
                    Banco
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-bold text-text-muted uppercase tracking-wider">
                    Cuenta
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-bold text-text-muted uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-bold text-text-muted uppercase tracking-wider">
                    Saldo
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredAccounts.map((acc) => {
                  const displayBalance = filterType === 'credit'
                    ? Math.abs(Number(acc.balance))
                    : Number(acc.balance);

                  const isNegative = Number(acc.balance) < 0 || acc.type === 'credit';

                  return (
                    <tr key={acc.id} className="hover:bg-background/50 transition">
                      <td className="px-6 py-4 text-sm font-medium text-text-main">
                        {acc.bank_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-text-main">
                        {acc.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-text-muted">
                        {getAccountTypeLabel(acc.type)}
                      </td>
                      <td className={`px-6 py-4 text-sm font-bold text-right ${
                        isNegative && filterType !== 'credit' ? 'text-red-400' : 'text-text-main'
                      }`}>
                        {formatCurrency(displayBalance)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="p-6 border-t border-border bg-background/30">
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-text-muted uppercase">Total</span>
            <span className={`text-2xl font-bold ${
              total < 0 && filterType !== 'credit' ? 'text-red-400' : 'text-primary'
            }`}>
              {formatCurrency(total)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
