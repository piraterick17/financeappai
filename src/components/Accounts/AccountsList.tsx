import { useEffect, useState } from 'react';
import { Plus, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Database } from '../../lib/database.types';
import { AddAccountModal } from './AddAccountModal';
import { EditAccountModal } from './EditAccountModal';
import { BankDetailsModal } from './BankDetailsModal';

type Account = Database['public']['Tables']['accounts']['Row'];

interface BankStack {
  bankName: string;
  accounts: Account[];
  totalBalance: number;
  bankInitial: string;
}

interface AccountsListProps {
  onViewDetails?: (accountId: string) => void;
}

export function AccountsList({ onViewDetails }: AccountsListProps) {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [bankStacks, setBankStacks] = useState<BankStack[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [selectedBank, setSelectedBank] = useState<BankStack | null>(null);

  useEffect(() => {
    if (user) {
      loadAccounts();
    }
  }, [user]);

  useEffect(() => {
    groupAccountsByBank();
  }, [accounts]);

  const loadAccounts = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      setAccounts(data);
    }
    setLoading(false);
  };

  const groupAccountsByBank = () => {
    const grouped = accounts.reduce((acc, account) => {
      const existing = acc.find((stack) => stack.bankName === account.bank_name);
      const balance = Number(account.balance) || 0;
      const adjustedBalance = account.type === 'credit' ? -balance : balance;

      if (existing) {
        existing.accounts.push(account);
        existing.totalBalance += adjustedBalance;
      } else {
        acc.push({
          bankName: account.bank_name,
          accounts: [account],
          totalBalance: adjustedBalance,
          bankInitial: account.bank_name.charAt(0).toUpperCase(),
        });
      }
      return acc;
    }, [] as BankStack[]);

    setBankStacks(grouped);
  };

  const handleDelete = async (accountId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta cuenta?')) return;

    const { error } = await supabase
      .from('accounts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', accountId);

    if (!error) {
      loadAccounts();
      setSelectedBank(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  const getTotalBalance = () => {
    const assets = accounts
      .filter(acc => acc.type !== 'credit')
      .reduce((sum, acc) => sum + (Number(acc.balance) || 0), 0);
    const liabilities = accounts
      .filter(acc => acc.type === 'credit')
      .reduce((sum, acc) => sum + Math.abs(Number(acc.balance) || 0), 0);
    return assets - liabilities;
  };

  const getTotalDebt = () => {
    return accounts
      .filter(acc => acc.type === 'credit')
      .reduce((sum, acc) => sum + Math.abs(Number(acc.balance) || 0), 0);
  };

  const getConsolidatedBalance = () => {
    return accounts
      .filter(acc => acc.type === 'debit' || acc.type === 'savings')
      .reduce((sum, acc) => sum + (Number(acc.balance) || 0), 0);
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

  const getAccountIcon = (type: string) => {
    const icons = {
      credit: '💳',
      debit: '🏦',
      savings: '🐷',
      investment: '📈',
    };
    return icons[type as keyof typeof icons] || '🏦';
  };

  const getStackColor = (index: number) => {
    const colors = [
      'blue',
      'purple',
      'teal',
      'emerald',
      'amber',
    ];
    return colors[index % colors.length];
  };

  if (loading) {
    return (
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-text-main">Resumen de Cuentas</h2>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-64 bg-surface rounded-xl"></div>
          <div className="h-64 bg-surface rounded-xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col w-full max-w-6xl mx-auto">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 sm:pb-8 border-b border-border">
          <div className="flex flex-col gap-2">
            <h1 className="text-text-main text-2xl sm:text-3xl lg:text-4xl font-black leading-tight tracking-tight">
              Resumen de Cuentas
            </h1>
            <p className="text-sm font-medium">
              <span className={`${getTotalBalance() >= 0 ? 'text-primary' : 'text-red-400'}`}>
                Patrimonio Neto: {formatCurrency(getTotalBalance())}
              </span>
              {getTotalDebt() > 0 && (
                <span className="text-text-muted ml-2 text-xs">
                  (Deuda: {formatCurrency(getTotalDebt())})
                </span>
              )}
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex w-full sm:w-auto sm:min-w-[140px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 sm:h-11 px-4 bg-primary text-primary-fg text-sm font-bold hover:bg-opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4 mr-2" />
            <span>Agregar Banco</span>
          </button>
        </header>

        {accounts.length === 0 ? (
          <div className="bg-surface/50 rounded-2xl p-8 sm:p-12 lg:p-16 text-center mt-6 sm:mt-10">
            <div className="text-4xl sm:text-5xl lg:text-6xl mb-4">🏦</div>
            <h3 className="text-xl sm:text-2xl font-semibold text-text-main mb-2">
              No tienes cuentas registradas
            </h3>
            <p className="text-text-muted mb-6 sm:mb-8 text-base sm:text-lg">
              Agrega tu primera cuenta o tarjeta para comenzar
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-6 sm:px-8 py-3 sm:py-4 bg-primary text-primary-fg font-bold rounded-lg hover:bg-opacity-90 transition"
            >
              Agregar Primera Cuenta
            </button>
          </div>
        ) : (
          <>
            {/* Vista Móvil - Lista Vertical Simple */}
            <div className="flex md:hidden flex-col gap-3 py-6">
              {bankStacks.map((stack) => (
                <div
                  key={stack.bankName}
                  onClick={() => setSelectedBank(stack)}
                  className="bg-surface border border-border p-4 rounded-xl flex items-center justify-between cursor-pointer hover:bg-surface/80 transition-colors active:scale-98 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-bold text-primary-fg">
                        {stack.bankInitial}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <h3 className="text-text-main font-bold text-sm leading-tight">
                        {stack.bankName}
                      </h3>
                      <p className="text-xs text-text-muted">
                        {stack.accounts.length} {stack.accounts.length === 1 ? 'cuenta' : 'cuentas'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className={`font-bold text-base ${stack.totalBalance < 0 ? 'text-red-400' : 'text-primary'
                        }`}>
                        {formatCurrency(stack.totalBalance)}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-text-muted flex-shrink-0" />
                  </div>
                </div>
              ))}
            </div>

            {/* Vista Escritorio - Pilas de Tarjetas */}
            <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-12 py-6 sm:py-8 lg:py-10">
              {bankStacks.map((stack, index) => {
                const color = getStackColor(index);

                return (
                  <div
                    key={stack.bankName}
                    onClick={() => setSelectedBank(stack)}
                    className="relative group cursor-pointer h-64 flex items-center justify-center p-4 transition-transform duration-300 hover:scale-105"
                  >
                    <div
                      className={`absolute w-40 h-40 bg-${color}-500/30 dark:bg-${color}-500/20 rounded-xl transform ${index % 2 === 0 ? 'rotate-[-15deg]' : 'rotate-[12deg]'
                        } transition-transform duration-300 ${index % 2 === 0 ? 'group-hover:rotate-[-20deg]' : 'group-hover:rotate-[18deg]'
                        }`}
                      style={{
                        backgroundColor: `rgb(59 130 246 / 0.2)`,
                      }}
                    ></div>
                    <div
                      className={`absolute w-44 h-44 bg-${color}-500/50 dark:bg-${color}-500/30 rounded-xl transform ${index % 2 === 0 ? 'rotate-[10deg]' : 'rotate-[-8deg]'
                        } transition-transform duration-300 ${index % 2 === 0 ? 'group-hover:rotate-[15deg]' : 'group-hover:rotate-[-14deg]'
                        }`}
                      style={{
                        backgroundColor: `rgb(59 130 246 / 0.3)`,
                      }}
                    ></div>
                    <div
                      className={`relative w-48 h-48 bg-surface rounded-xl shadow-2xl flex flex-col justify-between p-5 transform ${index % 2 === 0 ? 'rotate-[-5deg]' : 'rotate-[4deg]'
                        } transition-transform duration-300 group-hover:rotate-0`}
                    >
                      <div className="flex flex-col gap-2">
                        <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                          <span className="text-xl font-bold text-primary-fg">
                            {stack.bankInitial}
                          </span>
                        </div>
                        <h3 className="text-text-main text-sm font-bold leading-tight">
                          {stack.bankName}
                        </h3>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-text-muted">Saldo Total</p>
                        <p className={`text-2xl font-bold ${stack.totalBalance < 0 ? 'text-red-400' : 'text-text-main'
                          }`}>
                          {formatCurrency(stack.totalBalance)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {showAddModal && (
        <AddAccountModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            loadAccounts();
          }}
        />
      )}

      {editingAccount && (
        <EditAccountModal
          account={editingAccount}
          onClose={() => setEditingAccount(null)}
          onSuccess={() => {
            setEditingAccount(null);
            loadAccounts();
          }}
        />
      )}

      {selectedBank && (
        <BankDetailsModal
          bank={selectedBank}
          onClose={() => setSelectedBank(null)}
          onEdit={(account) => {
            setEditingAccount(account);
            setSelectedBank(null);
          }}
          onDelete={handleDelete}
          onViewDetails={onViewDetails}
        />
      )}
    </div>
  );
}
