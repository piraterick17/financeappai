import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Search, Building2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Database } from '../../lib/database.types';

type Bank = Database['public']['Tables']['banks']['Row'];

export function BanksManagement() {
  const { user } = useAuth();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [newBankName, setNewBankName] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadBanks();
    }
  }, [user]);

  const loadBanks = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('banks')
      .select('*')
      .order('is_system', { ascending: false })
      .order('name');

    if (data) {
      setBanks(data);
    }
    setLoading(false);
  };

  const handleAddBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newBankName.trim()) return;

    setModalLoading(true);

    const { error } = await supabase
      .from('banks')
      .insert({
        user_id: user.id,
        name: newBankName.trim(),
        is_system: false,
      });

    if (!error) {
      setNewBankName('');
      setShowAddModal(false);
      loadBanks();
    }
    setModalLoading(false);
  };

  const handleUpdateBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBank || !newBankName.trim()) return;

    setModalLoading(true);

    const { error } = await supabase
      .from('banks')
      .update({ name: newBankName.trim() })
      .eq('id', editingBank.id);

    if (!error) {
      setNewBankName('');
      setEditingBank(null);
      loadBanks();
    }
    setModalLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este banco?')) return;

    const { error } = await supabase
      .from('banks')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (!error) {
      loadBanks();
    }
  };

  const openEditModal = (bank: Bank) => {
    setEditingBank(bank);
    setNewBankName(bank.name);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingBank(null);
    setNewBankName('');
  };

  const filteredBanks = banks.filter(bank =>
    bank.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const userBanks = filteredBanks.filter(b => !b.is_system);
  const systemBanks = filteredBanks.filter(b => b.is_system);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-800 rounded w-1/3"></div>
        <div className="h-32 bg-gray-800 rounded"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <div className="flex-1">
          <div className="flex w-full items-stretch rounded-lg">
            <div className="text-[#92c9a4] flex bg-[#23482f] items-center justify-center pl-3 sm:pl-4 rounded-l-lg">
              <Search className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <input
              className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-r-lg text-white focus:outline-none focus:ring-2 focus:ring-primary/50 border-none bg-[#23482f] h-10 sm:h-12 placeholder:text-[#92c9a4] px-3 sm:px-4 text-sm sm:text-base font-normal"
              placeholder="Buscar bancos..."
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
          Nuevo Banco
        </button>
      </div>

      {userBanks.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-[#92c9a4]">Mis Bancos</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {userBanks.map((bank) => (
              <div
                key={bank.id}
                className="bg-[#1c3a27] rounded-lg p-4 border border-gray-800 hover:border-gray-700 transition flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-white font-medium">{bank.name}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEditModal(bank)}
                    className="p-2 text-gray-400 hover:text-primary rounded transition"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(bank.id)}
                    className="p-2 text-gray-400 hover:text-red-500 rounded transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-[#92c9a4]">Bancos del Sistema</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {systemBanks.map((bank) => (
            <div
              key={bank.id}
              className="bg-[#1c3a27] rounded-lg p-3 border border-gray-800 flex items-center gap-3"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-blue-400" />
              </div>
              <span className="text-white text-sm">{bank.name}</span>
            </div>
          ))}
        </div>
      </div>

      {(showAddModal || editingBank) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-[#112217] rounded-xl max-w-md w-full border border-gray-800">
            <div className="border-b border-gray-800 p-4 sm:p-6 flex items-center justify-between">
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                {editingBank ? 'Editar Banco' : 'Nuevo Banco'}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-white transition"
              >
                ×
              </button>
            </div>

            <form onSubmit={editingBank ? handleUpdateBank : handleAddBank} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#92c9a4] mb-2">
                  Nombre del Banco
                </label>
                <input
                  type="text"
                  value={newBankName}
                  onChange={(e) => setNewBankName(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-[#23482f] text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Ej: Mi Banco Local"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-3 bg-[#23482f] text-white rounded-lg font-medium hover:bg-[#2d5a3d] transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="flex-1 px-4 py-3 bg-primary text-[#112217] rounded-lg font-bold hover:bg-primary/90 transition disabled:opacity-50 shadow-lg"
                >
                  {modalLoading ? 'Guardando...' : editingBank ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
