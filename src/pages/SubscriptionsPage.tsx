import { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, CreditCard, Edit2, DollarSign, PauseCircle, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Database } from '../lib/database.types';
import { SubscriptionModal } from '../components/Subscriptions/SubscriptionModal';
import { differenceInMonths, parseISO } from 'date-fns';

type FixedExpense = Database['public']['Tables']['fixed_expenses']['Row'];

export function SubscriptionsPage() {
    const { user } = useAuth();
    const [subscriptions, setSubscriptions] = useState<FixedExpense[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingSubscription, setEditingSubscription] = useState<FixedExpense | null>(null);
    const [totalMonthly, setTotalMonthly] = useState(0);

    useEffect(() => {
        if (user) {
            loadSubscriptions();
        }
    }, [user]);

    const loadSubscriptions = async () => {
        if (!user) return;
        setLoading(true);

        const { data } = await supabase
            .from('fixed_expenses')
            .select('*')
            .eq('user_id', user.id)
            .is('deleted_at', null)
            .order('due_day');

        if (data) {
            setSubscriptions(data as FixedExpense[]);
            const total = (data as FixedExpense[]).reduce((sum, sub) => sum + Number(sub.amount), 0);
            setTotalMonthly(total);
        }
        setLoading(false);
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`¿Estás seguro de que deseas eliminar la suscripción a ${name}?`)) return;

        const { error } = await supabase
            .from('fixed_expenses')
            .update({ deleted_at: new Date().toISOString() } as any)
            .eq('id', id);

        if (error) {
            toast.error('Error al eliminar: ' + error.message);
        } else {
            toast.success('Suscripción eliminada');
            loadSubscriptions();
        }
    };

    const handleToggleStatus = async (sub: FixedExpense) => {
        const newStatus = !sub.is_active;
        const { error } = await supabase
            .from('fixed_expenses')
            .update({ is_active: newStatus } as any)
            .eq('id', sub.id);

        if (error) {
            toast.error('Error al actualizar estado: ' + error.message);
        } else {
            toast.success(newStatus ? 'Suscripción reactivada' : 'Suscripción pausada');
            loadSubscriptions();
        }
    };

    const handleEdit = (sub: FixedExpense) => {
        setEditingSubscription(sub);
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingSubscription(null);
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
        }).format(amount);
    };

    const calculateTotalPaid = (sub: FixedExpense) => {
        if (!sub.start_date) return 0;
        const start = parseISO(sub.start_date);
        const now = new Date();
        const months = differenceInMonths(now, start) + (now.getDate() >= sub.due_day ? 1 : 0); // Include current month if passed due day
        return Math.max(0, months) * sub.amount;
    };

    if (loading) {
        return (
            <div className="p-4 sm:p-6 lg:p-8 animate-pulse">
                <div className="h-8 bg-surface rounded w-48 mb-6"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-40 bg-surface rounded-xl"></div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
            <div className="sticky top-0 z-10 bg-background pb-4 pt-1 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-text-main">Suscripciones</h2>
                    <p className="text-text-muted mt-1">
                        Gasto mensual recurrente: <span className="text-green-500 font-bold">{formatCurrency(totalMonthly)}</span>
                    </p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-fg rounded-lg font-bold hover:bg-opacity-90 transition shadow-lg shadow-primary/20"
                >
                    <Plus className="w-5 h-5" />
                    Nueva Suscripción
                </button>
            </div>

            {subscriptions.length === 0 ? (
                <div className="text-center py-12 bg-surface rounded-xl border border-border">
                    <Calendar className="w-12 h-12 text-text-muted mx-auto mb-4" />
                    <h3 className="text-xl font-medium text-text-main mb-2">No tienes suscripciones activas</h3>
                    <p className="text-text-muted mb-6">Agrega tus servicios recurrentes para automatizar tus gastos.</p>
                    <button
                        onClick={() => setShowModal(true)}
                        className="px-6 py-2 bg-primary text-primary-fg rounded-lg font-bold hover:bg-opacity-90 transition"
                    >
                        Agregar Primera Suscripción
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {subscriptions.map((sub) => {
                        const totalPaid = calculateTotalPaid(sub);
                        return (
                            <div key={sub.id} className="bg-surface border border-border rounded-xl p-6 relative group hover:border-primary/50 transition duration-300 shadow-sm hover:shadow-md">
                                <div className="absolute top-4 right-4 flex gap-1 bg-surface/80 backdrop-blur-sm rounded-lg border border-border p-1">
                                    <button
                                        onClick={() => handleToggleStatus(sub)}
                                        className={`p-2 rounded-lg transition ${sub.is_active ? 'text-gray-400 hover:text-yellow-400 hover:bg-yellow-400/10' : 'text-yellow-400 hover:text-green-400 hover:bg-green-400/10'}`}
                                        title={sub.is_active ? "Pausar suscripción" : "Reanudar suscripción"}
                                    >
                                        {sub.is_active ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                                    </button>
                                    <button
                                        onClick={() => handleEdit(sub)}
                                        className="p-2 text-text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition"
                                        title="Editar suscripción"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(sub.id, sub.name)}
                                        className="p-2 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition"
                                        title="Eliminar suscripción"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="flex items-start justify-between mb-6 pr-16">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#1c3a27] to-[#112217] border border-[#23482f] flex items-center justify-center text-primary shadow-inner relative">
                                        <span className="font-bold text-xl">{sub.name.charAt(0).toUpperCase()}</span>
                                        {!sub.is_active && (
                                            <div className="absolute -bottom-1 -right-1 bg-yellow-500 rounded-full p-0.5 border-2 border-[#112217]">
                                                <PauseCircle className="w-3 h-3 text-[#112217] fill-yellow-500" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex justify-between items-start mb-1">
                                    <h3 className="text-lg font-bold text-text-main line-clamp-1">{sub.name}</h3>
                                    {!sub.is_active && <span className="text-xs bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded border border-yellow-500/20">Pausada</span>}
                                </div>

                                <p className="text-2xl font-bold text-text-main mb-1">{formatCurrency(sub.amount)}<span className="text-sm text-text-muted font-normal">/{sub.frequency === 'monthly' ? 'mes' : sub.frequency === 'annual' ? 'año' : sub.frequency}</span></p>

                                <div className="space-y-3 pt-4 border-t border-border/50">
                                    <div className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2 text-text-muted">
                                            <Calendar className="w-4 h-4 text-primary/80" />
                                            <span>Día de pago</span>
                                        </div>
                                        <span className="text-text-main font-medium">{sub.due_day}</span>
                                    </div>

                                    <div className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2 text-text-muted">
                                            <DollarSign className="w-4 h-4 text-primary/80" />
                                            <span>Total pagado est.</span>
                                        </div>
                                        <span className="text-green-400 font-medium">{formatCurrency(totalPaid)}</span>
                                    </div>

                                    <div className="flex items-center gap-2 text-xs text-text-muted mt-2 bg-background/50 p-2 rounded-lg">
                                        <CreditCard className="w-3 h-3" />
                                        <span>Cargo automático</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <SubscriptionModal
                isOpen={showModal}
                onClose={handleCloseModal}
                onSuccess={() => {
                    handleCloseModal();
                    loadSubscriptions();
                }}
                subscriptionToEdit={editingSubscription}
            />
        </div>
    );
}
