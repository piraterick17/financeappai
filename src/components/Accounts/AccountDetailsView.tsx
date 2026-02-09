import { useEffect, useState } from 'react';
import { ArrowLeft, Edit, Download, Send } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Database } from '../../lib/database.types';

type Account = Database['public']['Tables']['accounts']['Row'];
type Transaction = Database['public']['Tables']['transactions']['Row'];

type CreditAccount = Account & {
  cut_off_day?: number;
  payment_due_day?: number;
};

import { EditAccountModal } from './EditAccountModal';

interface AccountDetailsViewProps {
  accountId: string;
  onBack: () => void;
}

export function AccountDetailsView({ accountId, onBack }: AccountDetailsViewProps) {
  const { user } = useAuth();
  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  useEffect(() => {
    if (user && accountId) {
      loadAccountDetails();
      loadTransactions();
    }
  }, [user, accountId]);

  const loadAccountDetails = async () => {
    const { data } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', accountId)
      .maybeSingle();

    if (data) {
      setAccount(data);
    }
    setLoading(false);
  };

  const loadTransactions = async () => {
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('account_id', accountId)
      .order('transaction_date', { ascending: false })
      .limit(10);

    if (data) {
      setTransactions(data);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T12:00:00');
    return new Intl.DateTimeFormat('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
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

  const maskCardNumber = (name: string) => {
    const lastFour = name.slice(-4).padStart(4, '0');
    return `**** **** **** ${lastFour}`;
  };

  const handleDownloadStatement = () => {
    toast.info('Función de descarga de extracto próximamente disponible');
  };

  const handleTransfer = () => {
    toast.info('Función de transferencia próximamente disponible');
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-800 rounded w-1/3"></div>
          <div className="h-64 bg-gray-800 rounded"></div>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="p-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver a Cuentas
        </button>
        <div className="bg-gray-900/50 rounded-2xl p-16 text-center">
          <p className="text-white text-xl">Cuenta no encontrada</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 sm:mb-6 transition"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm sm:text-base">Volver a Cuentas</span>
        </button>

        <div className="flex flex-wrap justify-between gap-3 mb-4 sm:mb-6">
          <div className="flex flex-col gap-2">
            <p className="text-white text-2xl sm:text-3xl lg:text-4xl font-black leading-tight tracking-tight">
              Detalles de la Cuenta
            </p>
            <p className="text-[#92c9a4] text-sm sm:text-base font-normal">
              Toda la información relevante de tu cuenta o tarjeta.
            </p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 items-start">
          <div className="flex-grow w-full">
            <div className="flex flex-col rounded-xl bg-[#193322] shadow-lg overflow-hidden">
              <div
                className="w-full bg-center bg-no-repeat aspect-[2/1] bg-cover"
                style={{
                  backgroundImage:
                    'url("https://lh3.googleusercontent.com/aida-public/AB6AXuA09r_wFVgLzuIXkh9aynzZMJhsXd5qkJpWx8m1Se8NrwFi1ceOxz0Oac0ulvm-DAqeLcKE4gyEvax-PlGUBSMvSIbc8qas_UikDMJC1JY8Qyota8aajwtejF3S8Og6YEbNaCuWwzVH0PrXoiRDCfLyNhOT93x8J6h4WMcJlSf2VVEKavFJDiWKHJSa8K557voGJKfebyx4e6-TCF7vKa5NhwQ6INy_ghh6qFyPu8mKzxCsaGz3oO7AIk_B-eU9JTQdwqdjztU2Vhw")',
                }}
              ></div>
              <div className="flex flex-col gap-3 p-4 sm:p-6">
                <p className="text-[#92c9a4] text-xs sm:text-sm font-normal">
                  {getAccountTypeLabel(account.type)}
                </p>
                <p className="text-white text-base sm:text-lg font-bold leading-tight">
                  {account.bank_name} - {account.name}
                </p>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <p className="text-[#92c9a4] text-sm sm:text-base font-normal tracking-wider">
                      {maskCardNumber(account.name)}
                    </p>
                    <div>
                      <p className="text-[#92c9a4] text-xs sm:text-sm font-normal">Balance Actual</p>
                      <p className="text-white text-2xl sm:text-3xl font-bold leading-tight">
                        {formatCurrency(Number(account.balance))}
                      </p>
                    </div>
                    {account.type === 'credit' && account.credit_limit && (
                      <div className="mt-2">
                        <p className="text-[#92c9a4] text-xs sm:text-sm font-normal">Límite de Crédito</p>
                        <p className="text-white text-lg sm:text-xl font-semibold">
                          {formatCurrency(Number(account.credit_limit))}
                        </p>
                      </div>
                    )}


                    {account.type === 'credit' &&
                      ((account as CreditAccount).cut_off_day || (account as CreditAccount).payment_due_day) && (
                        <div className="flex gap-4 mt-3 pt-3 border-t border-gray-700">
                          {(account as CreditAccount).cut_off_day && (
                            <div>
                              <p className="text-[#92c9a4] text-xs">Día de Corte</p>
                              <p className="text-white text-sm font-medium">
                                Día {(account as CreditAccount).cut_off_day}
                              </p>
                            </div>
                          )}
                          {(account as CreditAccount).payment_due_day && (
                            <div>
                              <p className="text-[#92c9a4] text-xs">Día de Pago</p>
                              <p className="text-white text-sm font-medium">
                                Día {(account as CreditAccount).payment_due_day}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-shrink-0 w-full lg:w-auto">
            <div className="flex flex-col gap-3 p-4">
              <button
                onClick={handleTransfer}
                className="flex w-full lg:min-w-[200px] items-center justify-center gap-2 rounded-lg h-10 sm:h-11 px-4 bg-[#11d452] text-[#112217] text-sm font-bold hover:bg-opacity-90 transition"
              >
                <Send className="w-4 h-4" />
                <span>Realizar Transferencia</span>
              </button>
              <button
                onClick={() => setEditingAccount(account)}
                className="flex w-full lg:min-w-[200px] items-center justify-center gap-2 rounded-lg h-10 sm:h-11 px-4 bg-[#23482f] text-white text-sm font-bold hover:bg-[#2d5a3d] transition"
              >
                <Edit className="w-4 h-4" />
                <span>Editar Cuenta</span>
              </button>
              <button
                onClick={handleDownloadStatement}
                className="flex w-full lg:min-w-[200px] items-center justify-center gap-2 rounded-lg h-10 sm:h-11 px-4 bg-[#23482f] text-white text-sm font-bold hover:bg-[#2d5a3d] transition"
              >
                <Download className="w-4 h-4" />
                <span>Descargar Extracto</span>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 sm:mt-8">
          <h2 className="text-white text-lg sm:text-xl lg:text-[22px] font-bold leading-tight tracking-tight px-2 sm:px-4 pb-3 pt-5">
            Transacciones Recientes
          </h2>
          <div className="overflow-x-auto bg-[#193322] rounded-xl p-2 sm:p-4">
            {transactions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400 text-lg">No hay transacciones registradas</p>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead className="border-b border-zinc-700">
                  <tr>
                    <th className="p-4 text-sm font-medium text-[#92c9a4]">Fecha</th>
                    <th className="p-4 text-sm font-medium text-[#92c9a4]">Descripción</th>
                    <th className="p-4 text-sm font-medium text-[#92c9a4]">Categoría</th>
                    <th className="p-4 text-sm font-medium text-[#92c9a4] text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction, index) => {
                    const isIncome = transaction.type === 'income';
                    const amount = Number(transaction.amount);
                    return (
                      <tr
                        key={transaction.id}
                        className={
                          index < transactions.length - 1
                            ? 'border-b border-zinc-800'
                            : ''
                        }
                      >
                        <td className="p-4 text-sm text-zinc-300">
                          {formatDate(transaction.transaction_date)}
                        </td>
                        <td className="p-4 text-sm font-medium text-white">
                          {transaction.description}
                        </td>
                        <td className="p-4 text-sm text-zinc-300 capitalize">
                          {transaction.category}
                        </td>
                        <td
                          className={`p-4 text-sm font-medium text-right ${isIncome ? 'text-[#11d452]' : 'text-red-400'
                            }`}
                        >
                          {isIncome ? '+' : '-'}
                          {formatCurrency(Math.abs(amount))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {editingAccount && (
        <EditAccountModal
          account={editingAccount}
          onClose={() => setEditingAccount(null)}
          onSuccess={() => {
            setEditingAccount(null);
            loadAccountDetails();
          }}
        />
      )}
    </div>
  );
}
