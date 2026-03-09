import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useSuppliers } from '../../hooks/useSuppliers';
import { Database } from '../../lib/database.types';

type Transaction = Database['public']['Tables']['transactions']['Row'];
type Account = Database['public']['Tables']['accounts']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];

interface EditTransactionModalProps {
  transaction: Transaction;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditTransactionModal({ transaction, onClose, onSuccess }: EditTransactionModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const { data: suppliers = [] } = useSuppliers(user?.id);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    description: transaction.description,
    amount: Math.abs(Number(transaction.amount)).toString(),
    type: transaction.type,
    transaction_date: transaction.transaction_date.split('T')[0],
    transaction_time: transaction.transaction_time || '',
    category: transaction.category || '',
    account_id: transaction.account_id,
    supplier_id: transaction.supplier_id || '',
    is_recurring: transaction.is_recurring || false,
    recurring_frequency: (transaction as any).recurring_frequency || 'monthly',
    recurring_day: (transaction as any).recurring_day || 1,
  });

  useEffect(() => {
    if (user) {
      loadAccounts();
      loadCategories();
    }
  }, [user]);

  const loadAccounts = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .order('name');

    if (data) {
      setAccounts(data);
    }
  };

  const loadCategories = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('name');

    if (data) {
      setCategories(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Por favor ingresa un monto válido');
      setLoading(false);
      return;
    }

    const transactionAmount = formData.type === 'expense' ? -Math.abs(amount) : Math.abs(amount);

    const { error } = await supabase
      .from('transactions')
      .update({
        description: formData.description,
        amount: transactionAmount,
        type: formData.type,
        transaction_date: formData.transaction_date,
        transaction_time: formData.transaction_time || null,
        category: formData.category || null,
        account_id: formData.account_id,
        supplier_id: formData.supplier_id || null,
        is_recurring: formData.is_recurring,
        recurring_frequency: formData.is_recurring ? formData.recurring_frequency : null,
        recurring_day: formData.is_recurring ? formData.recurring_day : null,
      })
      .eq('id', transaction.id);

    if (error) {
      console.error('Error updating transaction:', error);
      toast.error('Error al actualizar la transacción');
      setLoading(false);
      return;
    }

    toast.success('Transacción actualizada exitosamente');
    setLoading(false);
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
    queryClient.invalidateQueries({ queryKey: ['categories'] });
    onSuccess();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 z-[60]">
      <div className="bg-surface w-full h-full sm:h-auto sm:rounded-xl sm:max-w-md sm:max-h-[90vh] overflow-y-auto sm:border sm:border-border">
        <div className="sticky top-0 bg-surface border-b border-border p-4 sm:p-6 flex items-center justify-between z-10">
          <h2 className="text-xl sm:text-2xl font-bold text-text-main">Editar Transacción</h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-main transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-muted mb-2">
              Tipo de Transacción
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'expense' })}
                className={`py-3 px-4 rounded-lg font-medium transition ${formData.type === 'expense'
                  ? 'bg-red-500 text-white'
                  : 'bg-background text-text-muted hover:bg-surface'
                  }`}
              >
                Gasto
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'income' })}
                className={`py-3 px-4 rounded-lg font-medium transition ${formData.type === 'income'
                  ? 'bg-green-500 text-white'
                  : 'bg-background text-text-muted hover:bg-surface'
                  }`}
              >
                Ingreso
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-2">
              Descripción
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 rounded-lg bg-[#23482f] text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/50"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-2">
              Monto
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full px-4 py-3 rounded-lg bg-[#23482f] text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/50"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-2">
              Cuenta
            </label>
            <select
              value={formData.account_id}
              onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
              className="w-full px-4 py-3 rounded-lg bg-[#23482f] text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/50"
              required
            >
              <option value="">Selecciona una cuenta</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.bank_name} - {account.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-2">
              Categoría
            </label>
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
            <label className="block text-sm font-medium text-text-muted mb-2">
              Proveedor (opcional)
            </label>
            <select
              value={formData.supplier_id}
              onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
              className="w-full px-4 py-3 rounded-lg bg-[#23482f] text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">Sin proveedor</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">
                Fecha
              </label>
              <input
                type="date"
                value={formData.transaction_date}
                onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-background text-text-main border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">
                Hora (opcional)
              </label>
              <input
                type="time"
                value={formData.transaction_time}
                onChange={(e) => setFormData({ ...formData, transaction_time: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-background text-text-main border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_recurring}
                onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                className="w-5 h-5 rounded border-border bg-background text-primary focus:ring-primary focus:ring-offset-0"
              />
              <span className="text-text-main font-medium">Configurar como compra recurrente</span>
            </label>
          </div>

          {formData.is_recurring && (
            <div className="bg-background p-4 rounded-lg space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-2">
                    Frecuencia
                  </label>
                  <select
                    value={formData.recurring_frequency}
                    onChange={(e) => setFormData({ ...formData, recurring_frequency: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg bg-background text-text-main border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="daily">Diario</option>
                    <option value="weekly">Semanal</option>
                    <option value="monthly">Mensual</option>
                    <option value="yearly">Anual</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#92c9a4] mb-2">
                    {formData.recurring_frequency === 'monthly' ? 'Día del mes' :
                      formData.recurring_frequency === 'weekly' ? 'Día de la semana (1-7)' :
                        formData.recurring_frequency === 'yearly' ? 'Día del año (1-365)' : 'Intervalo'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={formData.recurring_frequency === 'monthly' ? 31 :
                      formData.recurring_frequency === 'weekly' ? 7 :
                        formData.recurring_frequency === 'yearly' ? 365 : 365}
                    value={formData.recurring_day}
                    onChange={(e) => setFormData({ ...formData, recurring_day: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 rounded-lg bg-background text-text-main border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>
              <p className="text-xs text-text-muted">
                Esta transacción se repetirá automáticamente según la frecuencia configurada.
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-background text-text-main rounded-lg font-medium hover:bg-surface transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-primary text-primary-fg rounded-lg font-bold hover:opacity-90 transition disabled:opacity-50 shadow-lg"
            >
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
