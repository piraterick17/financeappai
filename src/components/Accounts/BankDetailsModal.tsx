import { X, Eye, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Database } from '../../lib/database.types';

type Account = Database['public']['Tables']['accounts']['Row'];

interface BankStack {
  bankName: string;
  accounts: Account[];
  totalBalance: number;
  bankInitial: string;
}

interface BankDetailsModalProps {
  bank: BankStack;
  onClose: () => void;
  onEdit: (account: Account) => void;
  onDelete: (accountId: string) => void;
  onViewDetails?: (accountId: string) => void;
}

export function BankDetailsModal({
  bank,
  onClose,
  onEdit,
  onDelete,
  onViewDetails
}: BankDetailsModalProps) {
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

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

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-surface w-full h-full sm:h-auto sm:rounded-2xl sm:max-w-5xl sm:max-h-[90vh] overflow-y-auto sm:border sm:border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-surface border-b border-border p-6 flex justify-between items-center z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-2xl font-bold text-primary-fg">
                {bank.bankInitial}
              </span>
            </div>
            <div>
              <h3 className="text-text-main text-xl font-bold">{bank.bankName}</h3>
              <p className="text-sm text-text-muted">
                {bank.accounts.length} cuenta{bank.accounts.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-text-muted">Saldo Consolidado</p>
              <p className="text-2xl font-bold text-text-main">
                {formatCurrency(bank.totalBalance)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-background rounded-lg transition flex-shrink-0"
              aria-label="Cerrar modal"
            >
              <X className="w-6 h-6 text-text-muted" />
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {bank.accounts.map((account) => {
              const isMenuOpen = menuOpen === account.id;
              return (
                <div
                  key={account.id}
                  className="bg-background p-5 rounded-lg shadow-lg border border-border hover:border-primary/30 transition relative"
                >
                  <div className="flex justify-between items-start mb-3">
                    <p className="text-sm font-medium text-text-muted">
                      {getAccountTypeLabel(account.type)}
                    </p>
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpen(isMenuOpen ? null : account.id);
                        }}
                        className="p-1 hover:bg-surface rounded transition"
                      >
                        <svg
                          className="w-4 h-4 text-text-muted"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                        </svg>
                      </button>
                      {isMenuOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-30"
                            onClick={() => setMenuOpen(null)}
                          ></div>
                          <div className="absolute right-0 mt-2 w-48 bg-surface rounded-lg shadow-xl border border-border py-2 z-40">
                            {onViewDetails && (
                              <button
                                onClick={() => {
                                  onViewDetails(account.id);
                                  setMenuOpen(null);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-text-main hover:bg-background flex items-center gap-2"
                              >
                                <Eye className="w-4 h-4" />
                                Ver Detalles
                              </button>
                            )}
                            <button
                              onClick={() => {
                                onEdit(account);
                                setMenuOpen(null);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-text-main hover:bg-background flex items-center gap-2"
                            >
                              <Pencil className="w-4 h-4" />
                              Editar
                            </button>
                            <button
                              onClick={() => {
                                onDelete(account.id);
                                setMenuOpen(null);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-background flex items-center gap-2"
                            >
                              <Trash2 className="w-4 h-4" />
                              Eliminar
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  {account.type === 'credit' ? (
                    <>
                      <p className="text-xs text-red-400 uppercase font-semibold mt-1">Deuda actual</p>
                      <p className="text-xl font-bold text-red-400 mt-1">
                        {formatCurrency(Number(account.balance))}
                      </p>
                    </>
                  ) : (
                    <p className="text-xl font-bold text-text-main mt-2">
                      {formatCurrency(Number(account.balance))}
                    </p>
                  )}
                  <p className="text-xs text-text-muted mt-3">
                    **** {account.name.slice(-4).padStart(4, '0')}
                  </p>
                  {account.type === 'credit' && account.credit_limit && (
                    <div className="mt-3 pt-3 border-t border-gray-700/50">
                      <p className="text-xs text-text-muted">
                        Límite: {formatCurrency(Number(account.credit_limit))}
                      </p>
                      {account.amount_due && Number(account.amount_due) > 0 && (
                        <p className="text-xs text-red-400 mt-1">
                          Adeudo: {formatCurrency(Number(account.amount_due))}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
