import { useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { Database } from '../../lib/database.types';

type Supplier = Database['public']['Tables']['suppliers']['Row'];

interface EditSupplierModalProps {
  supplier: Supplier;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditSupplierModal({ supplier, onClose, onSuccess }: EditSupplierModalProps) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(supplier.name);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);

    const { error } = await supabase
      .from('suppliers')
      .update({
        name: name.trim(),
      })
      .eq('id', supplier.id);

    if (error) {
      console.error('Error updating supplier:', error);
      toast.error('Error al actualizar el proveedor');
      setLoading(false);
      return;
    }

    toast.success('Proveedor actualizado exitosamente');
    setLoading(false);
    onSuccess();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-[#112217] rounded-xl max-w-md w-full border border-gray-800">
        <div className="border-b border-gray-800 p-4 sm:p-6 flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-bold text-white">Editar Proveedor</h2>
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
              Nombre del Proveedor
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-[#23482f] text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/50"
              required
            />
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
