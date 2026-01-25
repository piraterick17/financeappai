import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Database } from '../../lib/database.types';
import { MEXICAN_BANKS } from '../../data/mexicanBanks';

type Account = Database['public']['Tables']['accounts']['Row'];

interface EditAccountModalProps {
  account: Account;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditAccountModal({ account, onClose, onSuccess }: EditAccountModalProps) {
  const [formData, setFormData] = useState({
    name: account.name,
    bank_name: account.bank_name,
    type: account.type as 'debit' | 'credit' | 'savings' | 'investment',
    balance: account.balance?.toString() || '0',
    credit_limit: account.credit_limit?.toString() || '',
    cut_off_day: (account as any).cut_off_day?.toString() || '',
    payment_due_day: (account as any).payment_due_day?.toString() || '',
    card_number: (account as any).card_number || '',
    billing_period_start_day: (account as any).billing_period_start_day?.toString() || '',
    billing_period_end_day: (account as any).billing_period_end_day?.toString() || '',
  });
  const [calculatedAmount, setCalculatedAmount] = useState<number | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCalculateAmount = async () => {
    if (formData.type !== 'credit') return;

    setCalculating(true);
    try {
      const { data, error } = await supabase.rpc('calculate_credit_card_amount_due', {
        p_account_id: account.id
      });

      if (error) throw error;
      setCalculatedAmount(data);
    } catch (err: any) {
      setError('Error al calcular el monto: ' + err.message);
    } finally {
      setCalculating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError('');

    const updateData: any = {
      name: formData.name,
      bank_name: formData.bank_name,
      type: formData.type,
      balance: parseFloat(formData.balance) || 0,
      credit_limit:
        formData.type === 'credit' && formData.credit_limit
          ? parseFloat(formData.credit_limit)
          : null,
      card_number: formData.card_number || null,
    };

    if (formData.type === 'credit') {
      updateData.cut_off_day = formData.cut_off_day ? parseInt(formData.cut_off_day) : null;
      updateData.payment_due_day = formData.payment_due_day ? parseInt(formData.payment_due_day) : null;
      updateData.billing_period_start_day = formData.billing_period_start_day ? parseInt(formData.billing_period_start_day) : null;
      updateData.billing_period_end_day = formData.billing_period_end_day ? parseInt(formData.billing_period_end_day) : null;

      if (calculatedAmount !== null) {
        updateData.amount_due = calculatedAmount;
      }
    }

    const { error: dbError } = await supabase
      .from('accounts')
      .update(updateData)
      .eq('id', account.id);

    if (dbError) {
      setError(dbError.message);
      setLoading(false);
    } else {
      onSuccess();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[60] overflow-y-auto">
      <div className="bg-[#1a3a2e] rounded-2xl max-w-md w-full p-4 sm:p-6 my-8 border border-emerald-500/30 max-h-[calc(100vh-4rem)] overflow-y-auto">
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <h3 className="text-lg sm:text-xl font-bold text-white">Editar Cuenta</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800/50 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Nombre de la Cuenta
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-white"
              placeholder="Ej: Visa Principal"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Banco
            </label>
            <select
              value={formData.bank_name}
              onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
              required
              className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-white"
            >
              <option value="">Selecciona un banco</option>
              {MEXICAN_BANKS.map((bank) => (
                <option key={bank} value={bank}>
                  {bank}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Tipo de Cuenta
            </label>
            <select
              value={formData.type}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  type: e.target.value as typeof formData.type,
                })
              }
              className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-white"
            >
              <option value="debit">Débito</option>
              <option value="credit">Crédito</option>
              <option value="savings">Ahorro</option>
              <option value="investment">Inversión</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Balance Actual
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.balance}
              onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
              required
              className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-white"
              placeholder="0.00"
            />
          </div>

          {formData.type === 'credit' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Límite de Crédito
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.credit_limit}
                  onChange={(e) =>
                    setFormData({ ...formData, credit_limit: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-white"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Número de Tarjeta (últimos 4 dígitos)
                </label>
                <input
                  type="text"
                  value={formData.card_number}
                  onChange={(e) =>
                    setFormData({ ...formData, card_number: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-white"
                  placeholder="**** **** **** 1234"
                  maxLength={19}
                />
              </div>

              <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-emerald-400 mb-3">Configuración del Periodo de Facturación</h4>
                <p className="text-xs text-gray-400 mb-4">
                  Define el rango de días para calcular automáticamente el monto a pagar. El sistema sumará todos los gastos realizados en este periodo.
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-2">
                      Día Inicio Periodo
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={formData.billing_period_start_day}
                      onChange={(e) =>
                        setFormData({ ...formData, billing_period_start_day: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-white text-sm"
                      placeholder="1-31"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">Primer día a contabilizar</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-2">
                      Día Fin Periodo
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={formData.billing_period_end_day}
                      onChange={(e) =>
                        setFormData({ ...formData, billing_period_end_day: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-white text-sm"
                      placeholder="1-31"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">Último día a contabilizar</p>
                  </div>
                </div>

                <div className="mt-3 p-2 bg-gray-800/30 rounded border border-gray-700">
                  <p className="text-[10px] text-gray-400">
                    <span className="font-semibold text-emerald-400">Ejemplo:</span> Si tu periodo va del día 25 al día 5 del siguiente mes, ingresa: Inicio=25, Fin=5
                  </p>
                </div>
              </div>

              <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-400">
                    Monto a Pagar
                  </label>
                  <button
                    type="button"
                    onClick={handleCalculateAmount}
                    disabled={calculating || !formData.billing_period_start_day || !formData.billing_period_end_day}
                    className="px-3 py-1 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
                  >
                    {calculating ? 'Calculando...' : 'Calcular'}
                  </button>
                </div>
                <div className="px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white text-lg font-mono">
                  $ {calculatedAmount !== null
                      ? new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(calculatedAmount)
                      : ((account as any).amount_due ? new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format((account as any).amount_due) : '0.00')
                  }
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  ℹ️ Haz clic en "Calcular" para obtener el monto basado en los gastos del periodo configurado
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Día de Corte
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={formData.cut_off_day}
                    onChange={(e) =>
                      setFormData({ ...formData, cut_off_day: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-white"
                    placeholder="1-31"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Día de Pago
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={formData.payment_due_day}
                    onChange={(e) =>
                      setFormData({ ...formData, payment_due_day: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-white"
                    placeholder="1-31"
                  />
                </div>
              </div>
            </>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-700 text-gray-300 font-medium rounded-lg hover:bg-gray-800/50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
