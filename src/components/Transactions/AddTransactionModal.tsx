import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Database } from '../../lib/database.types';

type Account = Database['public']['Tables']['accounts']['Row'];

interface AddTransactionModalProps {
  onClose: () => void;
  onSuccess: () => void;
  defaultType?: 'income' | 'expense';
}

export function AddTransactionModal({ onClose, onSuccess, defaultType = 'expense' }: AddTransactionModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [formData, setFormData] = useState({
    type: defaultType as 'income' | 'expense',
    account_id: '',
    amount: '',
    description: '',
    transaction_date: new Date().toISOString().split('T')[0],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      loadAccounts();
    }
  }, [user]);

  const loadAccounts = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('name');

    if (data) {
      setAccounts(data);
      if (data.length > 0 && !formData.account_id) {
        setFormData((prev) => ({ ...prev, account_id: data[0].id }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError('');

    const { error: dbError } = await supabase.from('transactions').insert({
      user_id: user.id,
      account_id: formData.account_id,
      type: formData.type,
      amount: parseFloat(formData.amount),
      description: formData.description,
      transaction_date: formData.transaction_date,
    });

    if (dbError) {
      toast.error('Error al crear la transacción: ' + dbError.message);
      setError(dbError.message);
      setLoading(false);
    } else {
      toast.success('Transacción creada exitosamente');
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      onSuccess();
    }
  };

  if (accounts.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60] overflow-y-auto">
        <div className="bg-[#112217] border border-gray-800 rounded-xl max-w-md w-full p-4 sm:p-6 my-8">
          <div className="flex justify-between items-center mb-4 sm:mb-6">
            <h3 className="text-lg sm:text-xl font-bold text-white">Nuevo Movimiento</h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-lg transition">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          <p className="text-gray-300 text-center py-6 sm:py-8 text-sm sm:text-base">
            Primero debes agregar al menos una cuenta antes de registrar movimientos.
          </p>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-primary hover:bg-opacity-90 text-[#112217] font-bold rounded-lg transition"
          >
            Entendido
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60] overflow-y-auto">
      <div className="bg-[#112217] border border-gray-800 rounded-xl max-w-md w-full p-4 sm:p-6 my-8 max-h-[calc(100vh-4rem)] overflow-y-auto">
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <h3 className="text-lg sm:text-xl font-bold text-white">Nuevo Movimiento</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-lg transition">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'income' })}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  formData.type === 'income'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Ingreso
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'expense' })}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  formData.type === 'expense'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Gasto
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cuenta</label>
            <select
              value={formData.account_id}
              onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} - {account.bank_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Monto</label>
            <input
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Descripción</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ej: Compra supermercado"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Fecha</label>
            <input
              type="date"
              value={formData.transaction_date}
              onChange={(e) =>
                setFormData({ ...formData, transaction_date: e.target.value })
              }
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
