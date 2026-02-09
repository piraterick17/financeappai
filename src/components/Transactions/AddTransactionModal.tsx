import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Database } from '../../lib/database.types';

type Account = Database['public']['Tables']['accounts']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];
type Supplier = Database['public']['Tables']['suppliers']['Row'];

interface AddTransactionModalProps {
  onClose: () => void;
  onSuccess: () => void;
  defaultType?: 'income' | 'expense';
}

export function AddTransactionModal({ onClose, onSuccess, defaultType = 'expense' }: AddTransactionModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [formData, setFormData] = useState({
    type: defaultType as 'income' | 'expense',
    account_id: '',
    amount: '',
    description: '',
    transaction_date: new Date().toISOString().split('T')[0],
    transaction_time: new Date().toLocaleTimeString('es-MX', { hour12: false, hour: '2-digit', minute: '2-digit' }),
    category: '',
    supplier_id: '',
    is_recurring: false,
    recurring_frequency: 'monthly',
    recurring_day: 1,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    // Load Accounts
    const { data: accData } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('name')
      .returns<Account[]>();

    if (accData) {
      setAccounts(accData);
      if (accData.length > 0 && !formData.account_id) {
        setFormData((prev) => ({ ...prev, account_id: accData[0].id }));
      }
    }

    // Load Categories
    const { data: catData } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('name')
      .returns<Category[]>();

    if (catData) setCategories(catData);

    // Load Suppliers
    const { data: supData } = await supabase
      .from('suppliers')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('name')
      .returns<Supplier[]>();

    if (supData) setSuppliers(supData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError('');

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Por favor ingresa un monto válido');
      setLoading(false);
      return;
    }

    // Determine final amount sign based on type
    const finalAmount = formData.type === 'expense' ? -Math.abs(amount) : Math.abs(amount);

    // Prepare transaction object matching Database type
    // Casting to any to allow supplier_id which is missing in types but present in DB
    const transactionData = {
      user_id: user.id,
      account_id: formData.account_id,
      type: formData.type,
      amount: finalAmount,
      description: formData.description,
      transaction_date: formData.transaction_date,
      transaction_time: formData.transaction_time || null,
      category: formData.category || null,
      supplier_id: formData.supplier_id || null,
      is_recurring: formData.is_recurring,
      recurrence_period: formData.is_recurring ? (formData.recurring_frequency as 'daily' | 'weekly' | 'monthly' | 'yearly') : null,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: dbError } = await supabase.from('transactions').insert(transactionData as any);

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
      <div className="bg-[#112217] border border-gray-800 rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-[#112217] border-b border-gray-800 p-4 sm:p-6 flex items-center justify-between z-10">
          <h3 className="text-xl font-bold text-white">Nuevo Movimiento</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-lg transition">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[#92c9a4] mb-2">Tipo de Transacción</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'income' })}
                className={`py-3 px-4 rounded-lg font-medium transition ${formData.type === 'income'
                  ? 'bg-green-600 text-white'
                  : 'bg-[#23482f] text-gray-400 hover:bg-[#2d5a3d]'
                  }`}
              >
                Ingreso
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'expense' })}
                className={`py-3 px-4 rounded-lg font-medium transition ${formData.type === 'expense'
                  ? 'bg-red-600 text-white'
                  : 'bg-[#23482f] text-gray-400 hover:bg-[#2d5a3d]'
                  }`}
              >
                Gasto
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#92c9a4] mb-2">Monto</label>
            <input
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              required
              className="w-full px-4 py-3 rounded-lg bg-[#23482f] text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#92c9a4] mb-2">Descripción</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              className="w-full px-4 py-3 rounded-lg bg-[#23482f] text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Ej: Compra supermercado"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#92c9a4] mb-2">Cuenta</label>
            <select
              value={formData.account_id}
              onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
              className="w-full px-4 py-3 rounded-lg bg-[#23482f] text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.bank_name} - {account.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#92c9a4] mb-2">Categoría</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-4 py-3 rounded-lg bg-[#23482f] text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Sin categoría</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#92c9a4] mb-2">Proveedor (Opcional)</label>
            <select
              value={formData.supplier_id}
              onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
              className="w-full px-4 py-3 rounded-lg bg-[#23482f] text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Sin proveedor</option>
              {suppliers.map((sup) => (
                <option key={sup.id} value={sup.id}>
                  {sup.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#92c9a4] mb-2">Fecha</label>
              <input
                type="date"
                value={formData.transaction_date}
                onChange={(e) =>
                  setFormData({ ...formData, transaction_date: e.target.value })
                }
                required
                className="w-full px-4 py-3 rounded-lg bg-[#23482f] text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#92c9a4] mb-2">Hora</label>
              <input
                type="time"
                value={formData.transaction_time}
                onChange={(e) =>
                  setFormData({ ...formData, transaction_time: e.target.value })
                }
                className="w-full px-4 py-3 rounded-lg bg-[#23482f] text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          <div className="border-t border-gray-700 pt-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_recurring}
                onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                className="w-5 h-5 rounded border-gray-600 bg-[#23482f] text-primary focus:ring-primary focus:ring-offset-0"
              />
              <span className="text-white font-medium">Configurar como recurrente</span>
            </label>
          </div>

          {formData.is_recurring && (
            <div className="bg-[#1c3a27] p-4 rounded-lg space-y-3">
              <div>
                <label className="block text-sm font-medium text-[#92c9a4] mb-2">Frecuencia</label>
                <select
                  value={formData.recurring_frequency}
                  onChange={(e) => setFormData({ ...formData, recurring_frequency: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-[#23482f] text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="daily">Diario</option>
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensual</option>
                  <option value="yearly">Anual</option>
                </select>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-600 text-gray-300 font-medium rounded-lg hover:bg-[#1c3a27] transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-[#11d452] hover:bg-[#0fc045] text-[#112217] font-bold rounded-lg transition disabled:opacity-50 shadow-lg"
            >
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
