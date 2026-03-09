import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Database } from '../../lib/database.types';

type Category = Database['public']['Tables']['categories']['Row'];
type Account = Database['public']['Tables']['accounts']['Row'];
type FixedExpense = Database['public']['Tables']['fixed_expenses']['Row'];

interface SubscriptionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    subscriptionToEdit?: FixedExpense | null;
}

export function SubscriptionModal({ isOpen, onClose, onSuccess, subscriptionToEdit }: SubscriptionModalProps) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [categories, setCategories] = useState<Category[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);

    const [formData, setFormData] = useState({
        name: '',
        amount: '',
        due_day: '1',
        category_id: '',
        account_id: '',
        start_date: new Date().toISOString().split('T')[0],
        frequency: 'monthly',
    });

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user) {
            loadData();
        }
    }, [user]);

    useEffect(() => {
        if (subscriptionToEdit) {
            setFormData({
                name: subscriptionToEdit.name,
                amount: subscriptionToEdit.amount.toString(),
                due_day: subscriptionToEdit.due_day.toString(),
                category_id: subscriptionToEdit.category_id || '',
                account_id: subscriptionToEdit.account_id,
                start_date: subscriptionToEdit.start_date || new Date().toISOString().split('T')[0],
                frequency: subscriptionToEdit.frequency || 'monthly',
            });
        } else {
            setFormData({
                name: '',
                amount: '',
                due_day: '1',
                category_id: '',
                account_id: '',
                start_date: new Date().toISOString().split('T')[0],
                frequency: 'monthly',
            });
        }
    }, [subscriptionToEdit, isOpen]);

    const loadData = async () => {
        if (!user) return;

        const [catRes, accRes] = await Promise.all([
            supabase.from('categories').select('*').eq('user_id', user.id).eq('type', 'expense').order('name'),
            supabase.from('accounts').select('*').eq('user_id', user.id).eq('is_active', true).order('name')
        ]);

        if (catRes.data) setCategories(catRes.data);
        if (accRes.data) setAccounts(accRes.data);
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

        const payload = {
            user_id: user.id,
            name: formData.name,
            amount: amount,
            due_day: parseInt(formData.due_day),
            category_id: formData.category_id || null,
            account_id: formData.account_id || accounts[0]?.id,
            is_active: subscriptionToEdit ? subscriptionToEdit.is_active : true,
            start_date: formData.start_date,
            frequency: formData.frequency,
        };

        // ... (rest of handleSubmit remains similar, simplified here for context)
        let error;

        if (subscriptionToEdit) {
            const { error: updateError } = await supabase
                .from('fixed_expenses')
                .update(payload)
                .eq('id', subscriptionToEdit.id);
            error = updateError;
        } else {
            const { error: insertError } = await supabase.from('fixed_expenses').insert(payload);
            error = insertError;
        }

        if (error) {
            toast.error('Error al guardar: ' + error.message);
        } else {
            toast.success(subscriptionToEdit ? 'Suscripción actualizada' : 'Suscripción creada');
            queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
            onSuccess();
        }
        setLoading(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 z-[60]">
            <div className="bg-surface w-full h-full sm:h-auto sm:rounded-2xl sm:max-w-md overflow-y-auto p-5 sm:p-6 sm:border sm:border-border shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-text-main">
                        {subscriptionToEdit ? 'Editar Suscripción' : 'Nueva Suscripción'}
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-background rounded-lg transition text-text-muted">
                        <X className="w-5 h-5 text-text-muted" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-text-muted mb-2">Nombre del Servicio</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-3 rounded-lg bg-background text-text-main border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                            placeholder="Ej: Netflix, Spotify, Gym"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-text-muted mb-2">Costo</label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                className="w-full px-4 py-3 rounded-lg bg-background text-text-main border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                                placeholder="0.00"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-muted mb-2">Frecuencia</label>
                            <select
                                value={formData.frequency}
                                onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                                className="w-full px-4 py-3 rounded-lg bg-background text-text-main border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                            >
                                <option value="monthly">Mensual</option>
                                <option value="bimonthly">Bimestral</option>
                                <option value="quarterly">Trimestral</option>
                                <option value="semiannual">Semestral</option>
                                <option value="annual">Anual</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-text-muted mb-2">Día de Pago</label>
                            <input
                                type="number"
                                min="1"
                                max="31"
                                value={formData.due_day}
                                onChange={(e) => setFormData({ ...formData, due_day: e.target.value })}
                                className="w-full px-4 py-3 rounded-lg bg-background text-text-main border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-muted mb-2">Fecha Inicio</label>
                            <input
                                type="date"
                                value={formData.start_date}
                                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                className="w-full px-4 py-3 rounded-lg bg-background text-text-main border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-muted mb-2">Categoría</label>
                        <select
                            value={formData.category_id}
                            onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                            className="w-full px-4 py-3 rounded-lg bg-background text-text-main border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                        >
                            <option value="">Seleccionar categoría</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-[#92c9a4] mb-2">Cuenta de Cargo</label>
                        <select
                            value={formData.account_id}
                            onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                            className="w-full px-4 py-3 rounded-lg bg-background text-text-main border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                            required
                        >
                            <option value="">Seleccionar cuenta</option>
                            {accounts.map(acc => (
                                <option key={acc.id} value={acc.id}>{acc.bank_name} - {acc.name}</option>
                            ))}
                        </select>
                    </div>

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
                            {loading ? 'Guardando...' : (subscriptionToEdit ? 'Actualizar' : 'Crear Suscripción')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
