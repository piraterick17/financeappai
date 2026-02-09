import { useState, useEffect } from 'react';
import { X, DollarSign, Tag } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useCategories } from '../../hooks/useCategories';
import { toast } from 'sonner';

interface BudgetLimitModalProps {
  onClose: () => void;
  onSuccess: () => void;
  existingBudget?: {
    category_id: string;
    amount: number;
  };
}

export function BudgetLimitModal({ onClose, onSuccess, existingBudget }: BudgetLimitModalProps) {
  const { user } = useAuth();
  const { data: categories = [], isLoading: categoriesLoading } = useCategories(user?.id);
  const [selectedCategoryId, setSelectedCategoryId] = useState(existingBudget?.category_id || '');
  const [amount, setAmount] = useState(existingBudget?.amount.toString() || '');
  const [loading, setLoading] = useState(false);

  const expenseCategories = categories.filter(c => c.type === 'expense');

  useEffect(() => {
    if (existingBudget) {
      setSelectedCategoryId(existingBudget.category_id);
      setAmount(existingBudget.amount.toString());
    }
  }, [existingBudget]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedCategoryId || !amount) return;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('El monto debe ser un número positivo');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('category_budgets')
        .upsert({
          user_id: user.id,
          category_id: selectedCategoryId,
          amount: numAmount,
        }, {
          onConflict: 'user_id,category_id'
        });

      if (error) throw error;

      toast.success('Límite de presupuesto guardado correctamente');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving budget limit:', error);
      toast.error('Error al guardar el límite de presupuesto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-[#112217] rounded-xl max-w-md w-full border border-gray-800 shadow-2xl">
        <div className="border-b border-gray-800 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">
            {existingBudget ? 'Editar Límite' : 'Definir Límite de Presupuesto'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-[#92c9a4] mb-2">
              Categoría de Gasto
            </label>
            {categoriesLoading ? (
              <div className="h-12 bg-[#23482f] rounded-lg animate-pulse"></div>
            ) : (
              <div className="relative">
                <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#92c9a4]" />
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-[#23482f] text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none"
                  required
                  disabled={!!existingBudget}
                >
                  <option value="">Seleccionar categoría...</option>
                  {expenseCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {existingBudget && (
              <p className="mt-2 text-xs text-gray-400">
                No puedes cambiar la categoría. Elimina este límite y crea uno nuevo si necesitas cambiarlo.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-[#92c9a4] mb-2">
              Límite Mensual
            </label>
            <div className="relative">
              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#92c9a4]" />
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                step="0.01"
                min="0"
                placeholder="0.00"
                className="w-full pl-12 pr-4 py-3 bg-[#23482f] text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/50"
                required
              />
            </div>
            <p className="mt-2 text-xs text-gray-400">
              Define cuánto quieres gastar como máximo al mes en esta categoría
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-[#23482f] text-white rounded-lg font-medium hover:bg-[#2d5a3d] transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !selectedCategoryId || !amount}
              className="flex-1 px-4 py-3 bg-primary text-[#112217] rounded-lg font-bold hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {loading ? 'Guardando...' : existingBudget ? 'Actualizar' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
