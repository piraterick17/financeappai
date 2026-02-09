import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PlusCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Database } from '../../lib/database.types';

type Category = Database['public']['Tables']['categories']['Row'];
type Account = Database['public']['Tables']['accounts']['Row'];

export function TransactionForm() {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const [categories, setCategories] = useState<Category[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        amount: '',
        description: '',
        category_id: '',
        account_id: '',
        date: new Date().toISOString().split('T')[0],
        type: 'expense' as 'income' | 'expense'
    });

    useEffect(() => {
        if (user) {
            loadData();
        }
    }, [user]);

    const loadData = async () => {
        if (!user) return;

        const [catRes, accRes] = await Promise.all([
            supabase.from('categories').select('*').eq('user_id', user.id).order('name'),
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

        const selectedCategory = categories.find(c => c.id === formData.category_id);

        // @ts-expect-error
        const { error } = await supabase.from('transactions').insert({
            user_id: user.id,
            account_id: formData.account_id,
            category_id: formData.category_id || null,
            category: selectedCategory?.name || null, // Persist the category name for display
            amount: amount,
            description: formData.description,
            transaction_date: formData.date,
            type: formData.type,
            is_recurring: false,
        });

        if (error) {
            toast.error('Error al guardar: ' + error.message);
        } else {
            toast.success('Transacción registrada exitosamente');
            queryClient.invalidateQueries({ queryKey: ['transactions'] });

            // Reset form but keep account/date preferences potentially? For now partial reset.
            setFormData(prev => ({
                ...prev,
                amount: '',
                description: '',
                // Keep account and category? Maybe better to clear category but keep account and date.
                // Let's clear basics.
                category_id: '',
                type: 'expense'
            }));
        }
        setLoading(false);
    };

    const filteredCategories = categories.filter(c => c.type === formData.type);

    return (
        <div className="bg-surface border border-border rounded-xl p-6 shadow-sm h-full">
            <div className="flex items-center gap-2 mb-6 text-text-main">
                <PlusCircle className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-bold">Registrar Transacción</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">

                {/* Type Selection */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-background/50 rounded-lg border border-border">
                    <button
                        type="button"
                        onClick={() => setFormData({ ...formData, type: 'expense', category_id: '' })}
                        className={`py-2 text-sm font-bold rounded-md transition ${formData.type === 'expense'
                            ? 'bg-red-500/20 text-red-400 shadow-sm'
                            : 'text-text-muted hover:text-text-main'
                            }`}
                    >
                        Gasto
                    </button>
                    <button
                        type="button"
                        onClick={() => setFormData({ ...formData, type: 'income', category_id: '' })}
                        className={`py-2 text-sm font-bold rounded-md transition ${formData.type === 'income'
                            ? 'bg-green-500/20 text-green-400 shadow-sm'
                            : 'text-text-muted hover:text-text-main'
                            }`}
                    >
                        Ingreso
                    </button>
                </div>

                <div>
                    <label className="block text-sm font-medium text-text-muted mb-2">Monto</label>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-bold text-lg">$</span>
                        <input
                            type="number"
                            step="0.01"
                            value={formData.amount}
                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                            className="w-full pl-10 pr-4 py-3 rounded-xl bg-background text-text-main border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 text-xl font-bold placeholder:text-gray-600"
                            placeholder="0.00"
                            autoFocus
                            required
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-text-muted mb-2">Descripción</label>
                    <input
                        type="text"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl bg-background text-text-main border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                        placeholder="¿Qué compraste?"
                        required
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-text-muted mb-2">Fecha</label>
                        <input
                            type="date"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl bg-background text-text-main border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-muted mb-2">Cuenta</label>
                        <select
                            value={formData.account_id}
                            onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl bg-background text-text-main border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                            required
                        >
                            <option value="">Seleccionar</option>
                            {accounts.map(acc => (
                                <option key={acc.id} value={acc.id}>{acc.bank_name} - {acc.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-text-muted mb-2">Categoría</label>
                    <select
                        value={formData.category_id}
                        onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl bg-background text-text-main border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                        required
                    >
                        <option value="">Seleccionar categoría</option>
                        {filteredCategories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                    </select>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 mt-2 bg-primary text-primary-fg rounded-xl font-bold hover:bg-opacity-90 transition shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <PlusCircle className="w-5 h-5" />
                    )}
                    {loading ? 'Guardando...' : 'Registrar Transacción'}
                </button>
            </form>
        </div>
    );
}
