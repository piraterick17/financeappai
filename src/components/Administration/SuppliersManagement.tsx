import { useState } from 'react';
import { Plus, Edit, Trash2, Search, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useSuppliers } from '../../hooks/useSuppliers';
import { Database } from '../../lib/database.types';
import { AddSupplierModal } from './AddSupplierModal';
import { EditSupplierModal } from './EditSupplierModal';

type Supplier = Database['public']['Tables']['suppliers']['Row'];

export function SuppliersManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: suppliers = [], isLoading: loading } = useSuppliers(user?.id);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar "${name}"?`)) return;

    const { error } = await supabase
      .from('suppliers')
      // @ts-expect-error deleted_at exists in DB
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (!error) {
      toast.success('Proveedor eliminado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    } else {
      console.error('Error deleting supplier:', error);
      toast.error('Error al eliminar el proveedor');
    }
  };

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-surface rounded w-1/3"></div>
        <div className="h-32 bg-surface rounded"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <div className="flex-1">
          <div className="flex w-full items-stretch rounded-lg">
            <div className="text-text-muted flex bg-background items-center justify-center pl-3 sm:pl-4 rounded-l-lg">
              <Search className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <input
              className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-r-lg text-text-main focus:outline-none focus:ring-2 focus:ring-primary/50 border border-border bg-background h-10 sm:h-12 placeholder:text-text-muted px-3 sm:px-4 text-sm sm:text-base font-normal"
              placeholder="Buscar proveedores..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-2 h-10 sm:h-12 px-4 sm:px-6 bg-primary text-primary-fg rounded-lg text-sm sm:text-base font-bold hover:bg-primary/90 transition shadow-lg"
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          Nuevo Proveedor
        </button>
      </div>

      {filteredSuppliers.length === 0 ? (
        <div className="text-center py-12 bg-surface rounded-lg border border-border">
          <Building2 className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <p className="text-text-muted text-lg">
            {searchTerm ? 'No se encontraron proveedores' : 'No hay proveedores registrados'}
          </p>
          {!searchTerm && (
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 text-primary hover:underline"
            >
              Crear tu primer proveedor
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSuppliers.map((supplier) => (
            <div
              key={supplier.id}
              className="bg-surface rounded-lg p-4 border border-border hover:border-primary/50 transition"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/20">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-text-main font-semibold">{supplier.name}</h3>
                    <p className="text-xs text-text-muted">
                      Proveedor
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end">
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingSupplier(supplier)}
                    className="p-2 text-text-muted hover:text-primary rounded transition"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(supplier.id, supplier.name)}
                    className="p-2 text-text-muted hover:text-red-500 rounded transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <AddSupplierModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
          }}
        />
      )}

      {editingSupplier && (
        <EditSupplierModal
          supplier={editingSupplier}
          onClose={() => setEditingSupplier(null)}
          onSuccess={() => {
            setEditingSupplier(null);
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
          }}
        />
      )}
    </div>
  );
}
