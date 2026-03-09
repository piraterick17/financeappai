import { useState, useEffect } from 'react';
import { X, ArrowRightLeft, AlertCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useAccounts } from '../../hooks/useAccounts';
import { toast } from 'sonner';

interface AddTransferModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function AddTransferModal({ onClose, onSuccess }: AddTransferModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: accountsData } = useAccounts(user?.id);

  const accounts = accountsData || [];

  const [formData, setFormData] = useState({
    sourceAccountId: '',
    destinationAccountId: '',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (accounts.length > 0 && !formData.sourceAccountId) {
      setFormData(prev => ({ ...prev, sourceAccountId: accounts[0].id }));
    }
  }, [accounts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (formData.sourceAccountId === formData.destinationAccountId) {
      setError('La cuenta de origen y destino no pueden ser la misma');
      return;
    }
    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      setError('El monto debe ser mayor a 0');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { error: rpcError } = await supabase.rpc('register_transfer', {
        p_user_id: user.id,
        p_source_account_id: formData.sourceAccountId,
        p_destination_account_id: formData.destinationAccountId,
        p_amount: amount,
        p_date: formData.date,
        p_description: formData.description || 'Transferencia entre cuentas'
      });
      if (rpcError) throw rpcError;
      toast.success('Transferencia realizada con éxito');

      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });

      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Error al realizar la transferencia';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const destinationOptions = accounts.filter(acc => acc.id !== formData.sourceAccountId);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-[60] sm:p-4">
      <div className="bg-surface w-full h-full sm:h-auto sm:rounded-xl sm:max-w-lg sm:border sm:border-border shadow-2xl">
        <div className="border-b border-border p-5 sm:p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 rounded-lg">
              <ArrowRightLeft className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-text-main">Transferir / Pagar Tarjeta</h2>
              <p className="text-sm text-text-muted mt-1">
                Mueve dinero entre tus cuentas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-main transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-5 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-900/20 border border-red-500/50 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Desde (Origen)</label>
              <select
                value={formData.sourceAccountId}
                onChange={(e) => setFormData({ ...formData, sourceAccountId: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-background text-text-main border border-border focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.bank_name} - {acc.name} (${acc.balance})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-center -my-2 relative z-10">
              <div className="bg-surface p-1 rounded-full border border-border">
                <ArrowRightLeft className="w-4 h-4 text-text-muted rotate-90" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Para (Destino)</label>
              <select
                value={formData.destinationAccountId}
                onChange={(e) => setFormData({ ...formData, destinationAccountId: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-background text-text-main border border-border focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Selecciona cuenta destino</option>
                {destinationOptions.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.bank_name} - {acc.name}
                    {acc.type === 'credit' ? ` (Deuda: $${acc.amount_due || 0})` : ` ($${acc.balance})`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Monto a Transferir</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full pl-8 pr-4 py-3 rounded-lg bg-background text-text-main border border-border focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-medium"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1">Fecha</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-background text-text-main border border-border focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Descripción</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-background text-text-main border border-border focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Pago tarjeta"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 border border-border text-text-muted font-medium rounded-lg hover:bg-background transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition disabled:opacity-50 shadow-lg shadow-blue-900/20"
              >
                {loading ? 'Procesando...' : 'Confirmar Transferencia'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
