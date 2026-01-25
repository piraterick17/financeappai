import { useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface SchedulePaymentModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function SchedulePaymentModal({ onClose, onSuccess }: SchedulePaymentModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [paymentType, setPaymentType] = useState<'fixed' | 'recurring'>('fixed');
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    due_day: '1',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);

    if (paymentType === 'fixed') {
      // Create a fixed expense
      const { error } = await supabase.from('fixed_expenses').insert({
        user_id: user.id,
        account_id: null, // Can be assigned later
        name: formData.name,
        amount: parseFloat(formData.amount),
        due_day: parseInt(formData.due_day),
        is_active: true,
      });

      if (error) {
        console.error('Error scheduling payment:', error);
        toast.error('Error al programar el pago');
      } else {
        toast.success('Pago programado exitosamente');
        onSuccess();
      }
    } else {
      // Create a recurring expense transaction
      const { error } = await supabase.from('transactions').insert({
        user_id: user.id,
        account_id: null,
        description: formData.name,
        amount: -Math.abs(parseFloat(formData.amount)),
        type: 'expense',
        transaction_date: new Date().toISOString().split('T')[0],
        is_recurring: true,
        recurring_frequency: 'monthly',
        recurring_day: parseInt(formData.due_day),
      });

      if (error) {
        console.error('Error scheduling payment:', error);
        toast.error('Error al programar el pago');
      } else {
        toast.success('Pago programado exitosamente');
        onSuccess();
      }
    }

    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
      <div className="bg-[#112217] rounded-2xl max-w-md w-full p-6 border border-gray-800">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white">Programar Pago</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800/50 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#92c9a4] mb-2">
              Tipo de Pago
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentType('fixed')}
                className={`px-4 py-3 rounded-lg font-medium transition ${
                  paymentType === 'fixed'
                    ? 'bg-primary text-[#112217]'
                    : 'bg-[#23482f] text-white hover:bg-[#2d5a3d]'
                }`}
              >
                Gasto Fijo
              </button>
              <button
                type="button"
                onClick={() => setPaymentType('recurring')}
                className={`px-4 py-3 rounded-lg font-medium transition ${
                  paymentType === 'recurring'
                    ? 'bg-primary text-[#112217]'
                    : 'bg-[#23482f] text-white hover:bg-[#2d5a3d]'
                }`}
              >
                Recurrente
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {paymentType === 'fixed'
                ? 'Gastos fijos son pagos mensuales predecibles (renta, luz, etc.)'
                : 'Gastos recurrentes se repiten cada mes automáticamente'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#92c9a4] mb-2">
              Descripción
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 rounded-lg bg-[#23482f] text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Ej: Renta, Netflix, Luz, etc."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#92c9a4] mb-2">
              Monto
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full px-4 py-3 rounded-lg bg-[#23482f] text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#92c9a4] mb-2">
              Día de vencimiento
            </label>
            <input
              type="number"
              min="1"
              max="31"
              value={formData.due_day}
              onChange={(e) => setFormData({ ...formData, due_day: e.target.value })}
              className="w-full px-4 py-3 rounded-lg bg-[#23482f] text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="1-31"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Este pago se programará cada mes en este día
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
              disabled={loading}
              className="flex-1 px-4 py-3 bg-[#11d452] text-[#112217] rounded-lg font-bold hover:bg-[#0fc045] transition disabled:opacity-50 shadow-lg"
            >
              {loading ? 'Guardando...' : 'Programar Pago'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
