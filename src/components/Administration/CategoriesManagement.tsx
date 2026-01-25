import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Search, Tag } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Database } from '../../lib/database.types';
import { AddCategoryModal } from './AddCategoryModal';
import { EditCategoryModal } from './EditCategoryModal';

type Category = Database['public']['Tables']['categories']['Row'];

export function CategoriesManagement() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [transactionCounts, setTransactionCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (user) {
      loadCategories();
      loadTransactionCounts();
    }
  }, [user]);

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
    setLoading(false);
  };

  const loadTransactionCounts = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('transactions')
      .select('category')
      .eq('user_id', user.id)
      .not('category', 'is', null);

    if (data) {
      const counts: Record<string, number> = {};
      data.forEach(t => {
        if (t.category) {
          counts[t.category] = (counts[t.category] || 0) + 1;
        }
      });
      setTransactionCounts(counts);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const count = transactionCounts[name] || 0;
    const message = count > 0
      ? `Esta categoría está siendo usada en ${count} transacción(es). ¿Deseas eliminarla? Las transacciones mantendrán la categoría en su historial.`
      : '¿Estás seguro de que deseas eliminar esta categoría?';

    if (!confirm(message)) return;

    const { error } = await supabase
      .from('categories')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (!error) {
      loadCategories();
      loadTransactionCounts();
    }
  };

  const getCategoryColor = (color: string | null) => {
    return color || '#92c9a4';
  };

  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(searchTerm.toLowerCase())
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
            <div className="text-[#92c9a4] flex bg-background items-center justify-center pl-3 sm:pl-4 rounded-l-lg">
              <Search className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <input
              className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-r-lg text-text-main focus:outline-none focus:ring-2 focus:ring-primary/50 border-none bg-background h-10 sm:h-12 placeholder:text-text-muted px-3 sm:px-4 text-sm sm:text-base font-normal"
              placeholder="Buscar categorías..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-2 h-10 sm:h-12 px-4 sm:px-6 bg-primary text-[#112217] rounded-lg text-sm sm:text-base font-bold hover:bg-primary/90 transition shadow-lg"
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          Nueva Categoría
        </button>
      </div>

      {filteredCategories.length === 0 ? (
        <div className="text-center py-12 bg-surface rounded-lg">
          <Tag className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <p className="text-text-muted text-lg">
            {searchTerm ? 'No se encontraron categorías' : 'No hay categorías registradas'}
          </p>
          {!searchTerm && (
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 text-primary hover:underline"
            >
              Crear tu primera categoría
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCategories.map((category) => (
            <div
              key={category.id}
              className="bg-surface rounded-lg p-4 border border-gray-800 hover:border-border transition"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: getCategoryColor(category.color) + '20' }}
                  >
                    <Tag
                      className="w-5 h-5"
                      style={{ color: getCategoryColor(category.color) }}
                    />
                  </div>
                  <div>
                    <h3 className="text-text-main font-semibold">{category.name}</h3>
                    <p className="text-xs text-text-muted capitalize">
                      {category.type === 'income' ? 'Ingreso' : 'Gasto'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-text-muted">
                  {transactionCounts[category.name] || 0} transacciones
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingCategory(category)}
                    className="p-2 text-text-muted hover:text-primary rounded transition"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(category.id, category.name)}
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
        <AddCategoryModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            loadCategories();
          }}
        />
      )}

      {editingCategory && (
        <EditCategoryModal
          category={editingCategory}
          onClose={() => setEditingCategory(null)}
          onSuccess={() => {
            setEditingCategory(null);
            loadCategories();
            loadTransactionCounts();
          }}
        />
      )}
    </div>
  );
}
