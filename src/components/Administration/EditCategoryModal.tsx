import { useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Database } from '../../lib/database.types';

type Category = Database['public']['Tables']['categories']['Row'];

interface EditCategoryModalProps {
  category: Category;
  onClose: () => void;
  onSuccess: () => void;
}

const PRESET_COLORS = [
  '#11d452', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#06b6d4', '#6366f1', '#ef4444', '#84cc16',
];

export function EditCategoryModal({ category, onClose, onSuccess }: EditCategoryModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: category.name,
    type: category.type,
    color: category.color || PRESET_COLORS[0],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);

    const oldName = category.name;
    const newName = formData.name.trim();

    const { error } = await supabase
      .from('categories')
      .update({
        name: newName,
        type: formData.type,
        color: formData.color,
      })
      .eq('id', category.id);

    if (error) {
      console.error('Error updating category:', error);
      toast.error('Error al actualizar la categoría');
      setLoading(false);
      return;
    }

    if (oldName !== newName) {
      await supabase
        .from('transactions')
        .update({ category: newName })
        .eq('category', oldName)
        .eq('user_id', user.id);
    }

    toast.success('Categoría actualizada exitosamente');
    setLoading(false);
    onSuccess();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-[#112217] rounded-xl max-w-md w-full border border-gray-800">
        <div className="border-b border-gray-800 p-4 sm:p-6 flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-bold text-white">Editar Categoría</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#92c9a4] mb-2">
              Nombre de la Categoría
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 rounded-lg bg-[#23482f] text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/50"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#92c9a4] mb-2">
              Tipo
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'expense' })}
                className={`py-3 px-4 rounded-lg font-medium transition ${
                  formData.type === 'expense'
                    ? 'bg-red-500 text-white'
                    : 'bg-[#23482f] text-gray-400 hover:bg-[#2d5a3d]'
                }`}
              >
                Gasto
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'income' })}
                className={`py-3 px-4 rounded-lg font-medium transition ${
                  formData.type === 'income'
                    ? 'bg-green-500 text-white'
                    : 'bg-[#23482f] text-gray-400 hover:bg-[#2d5a3d]'
                }`}
              >
                Ingreso
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#92c9a4] mb-2">
              Color
            </label>
            <div className="grid grid-cols-5 gap-3">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData({ ...formData, color })}
                  className={`w-full aspect-square rounded-lg transition ${
                    formData.color === color
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-[#112217]'
                      : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
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
              disabled={loading}
              className="flex-1 px-4 py-3 bg-[#11d452] text-[#112217] rounded-lg font-bold hover:bg-[#0fc045] transition disabled:opacity-50 shadow-lg"
            >
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
