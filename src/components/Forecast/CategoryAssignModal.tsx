import { useState, useEffect } from 'react';
import { X, Tag, AlertTriangle, RotateCcw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useCategories } from '../../hooks/useCategories';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface CategoryAssignModalProps {
    itemName: string;
    currentCategory: string; // Display name
    source: 'transaction' | 'fixed_expense' | 'credit_purchase';
    identifier: string; // description for transactions, UUID for others
    onClose: () => void;
    onSuccess: () => void;
}

export function CategoryAssignModal({
    itemName,
    currentCategory,
    source,
    identifier,
    onClose,
    onSuccess
}: CategoryAssignModalProps) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const { data: categories = [], isLoading: categoriesLoading } = useCategories(user?.id);
    const [selectedCategoryName, setSelectedCategoryName] = useState('');
    const [loading, setLoading] = useState(false);

    // Pre-select if currentCategory matches an existing category
    useEffect(() => {
        if (categories.length > 0 && currentCategory) {
            const match = categories.find(c => c.name === currentCategory);
            if (match) setSelectedCategoryName(match.name);
        }
    }, [categories, currentCategory]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !selectedCategoryName) return;

        if (!identifier) {
            toast.error('Error: No se pudo identificar el elemento para actualizar (ID faltante).');
            return;
        }

        setLoading(true);

        try {
            const selectedCategory = categories.find(c => c.name === selectedCategoryName);
            if (!selectedCategory) throw new Error('Categoría no válida');

            let error;

            if (source === 'transaction') {
                // Fetch candidates first to handle normalized descriptions (e.g. "Yamaha (1/12)")
                const { data: candidates, error: fetchError } = await supabase
                    .from('transactions')
                    .select('id, description')
                    .eq('user_id', user.id)
                    .ilike('description', identifier + '%') // Optimization: only fetch starting with identifier
                    .is('deleted_at', null);

                if (fetchError) throw fetchError;

                const matchingIds = candidates
                    .filter(t => {
                        const normalized = (t.description || '').replace(/\s*\(\d+\/\d+\).*/, '').trim();
                        return normalized === identifier;
                    })
                    .map(t => t.id);

                if (matchingIds.length > 0) {
                    const { error: err } = await supabase
                        .from('transactions')
                        .update({
                            category: selectedCategory.name,
                            category_id: selectedCategory.id
                        } as any)
                        .in('id', matchingIds);
                    error = err;
                } else {
                    // Fallback if no normalization needed (exact match)
                    const { error: err } = await supabase
                        .from('transactions')
                        .update({
                            category: selectedCategory.name,
                            category_id: selectedCategory.id
                        } as any)
                        .eq('user_id', user.id)
                        .eq('description', identifier);
                    error = err;
                }

            } else if (source === 'fixed_expense') {
                const { error: err } = await supabase
                    .from('fixed_expenses')
                    .update({ category_id: selectedCategory.id })
                    .eq('user_id', user.id)
                    .eq('id', identifier);
                error = err;
            } else if (source === 'credit_purchase') {
                const { error: err } = await supabase
                    .from('credit_purchases')
                    .update({ category_id: selectedCategory.id })
                    .eq('user_id', user.id)
                    .eq('id', identifier);
                error = err;
            }

            if (error) throw error;

            toast.success(`Categoría actualizada a "${selectedCategory.name}"`);

            queryClient.invalidateQueries({ queryKey: ['forecast-table'] });
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            queryClient.invalidateQueries({ queryKey: ['fixed-expenses'] });
            queryClient.invalidateQueries({ queryKey: ['credit-purchases'] });

            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error updating category:', error);
            toast.error('Error al actualizar la categoría');
        } finally {
            setLoading(false);
        }
    };

    const handleUnassign = async () => {
        if (!user || !identifier) return;
        if (!confirm('¿Estás seguro de quitar la categoría? El elemento volverá a aparecer sin agrupar.')) return;

        setLoading(true);
        try {
            let error;

            if (source === 'transaction') {
                const { data: candidates, error: fetchError } = await supabase
                    .from('transactions')
                    .select('id, description')
                    .eq('user_id', user.id)
                    .ilike('description', identifier + '%')
                    .is('deleted_at', null);

                if (fetchError) throw fetchError;

                const matchingIds = candidates
                    .filter(t => {
                        const normalized = (t.description || '').replace(/\s*\(\d+\/\d+\).*/, '').trim();
                        return normalized === identifier;
                    })
                    .map(t => t.id);

                if (matchingIds.length > 0) {
                    const { error: err } = await supabase
                        .from('transactions')
                        .update({
                            category: null,
                            category_id: null
                        } as any)
                        .in('id', matchingIds);
                    error = err;
                } else {
                    const { error: err } = await supabase
                        .from('transactions')
                        .update({
                            category: null,
                            category_id: null
                        } as any)
                        .eq('user_id', user.id)
                        .eq('description', identifier);
                    error = err;
                }

            } else if (source === 'fixed_expense') {
                const { error: err } = await supabase
                    .from('fixed_expenses')
                    .update({ category_id: null })
                    .eq('user_id', user.id)
                    .eq('id', identifier);
                error = err;
            } else if (source === 'credit_purchase') {
                const { error: err } = await supabase
                    .from('credit_purchases')
                    .update({ category_id: null })
                    .eq('user_id', user.id)
                    .eq('id', identifier);
                error = err;
            }

            if (error) throw error;

            toast.success('Categoría eliminada. El elemento está ahora sin agrupar.');

            queryClient.invalidateQueries({ queryKey: ['forecast-table'] });
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            queryClient.invalidateQueries({ queryKey: ['fixed-expenses'] });
            queryClient.invalidateQueries({ queryKey: ['credit-purchases'] });

            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error unassigning category:', error);
            toast.error('Error al quitar la categoría');
        } finally {
            setLoading(false);
        }
    };

    const categoryNameSet = new Set(categories.map(c => c.name));
    const isAlreadyProperCategory = categoryNameSet.has(currentCategory);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4" onClick={onClose}>
            <div className="bg-surface rounded-2xl max-w-md w-full border border-border shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="border-b border-border p-5 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-text-main">
                        Editar Categoría
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-text-muted hover:text-text-main transition p-1 rounded-lg hover:bg-background"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-5">
                    <div className="bg-background rounded-xl p-4 border border-border">
                        <p className="text-xs text-text-muted font-medium uppercase tracking-wider mb-1">
                            {source === 'transaction' ? 'Transacción (Agrupada)' :
                                source === 'fixed_expense' ? 'Gasto Fijo' :
                                    'Compra a Crédito'}
                        </p>
                        <p className="text-text-main font-semibold">{itemName}</p>
                        <p className="text-xs text-text-muted mt-1">
                            Categoría actual: <span className="font-medium text-text-main">{currentCategory}</span>
                        </p>
                        {!identifier && (
                            <p className="text-xs text-red-500 font-bold mt-2">
                                ⚠️ Error: ID no encontrado. No se podrá actualizar.
                            </p>
                        )}
                    </div>

                    {!isAlreadyProperCategory && (
                        <div className="flex items-start gap-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl p-3 text-xs border border-amber-500/20">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                            <p>
                                Este elemento no tiene una categoría definida.
                                Selecciona una categoría para corregirlo.
                            </p>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-semibold text-text-main mb-2">
                            Nueva Categoría
                        </label>
                        {categoriesLoading ? (
                            <div className="h-12 bg-background rounded-lg animate-pulse" />
                        ) : (
                            <>
                                <div className="relative">
                                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                                    <select
                                        value={selectedCategoryName}
                                        onChange={(e) => setSelectedCategoryName(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 bg-background text-text-main rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none transition"
                                        required
                                        disabled={!identifier}
                                    >
                                        <option value="">Seleccionar categoría...</option>
                                        {categories.map((category) => (
                                            <option key={category.id} value={category.name}>
                                                {category.name} ({category.type === 'income' ? 'Ingreso' : 'Gasto'})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="mt-4 pt-4 border-t border-border flex justify-end">
                                    <button
                                        type="button"
                                        onClick={handleUnassign}
                                        disabled={loading || !identifier}
                                        className="text-xs text-red-500 hover:text-red-600 font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        Quitar categoría (volver a sin agrupar)
                                    </button>
                                </div>
                            </>
                        )}

                        <p className="mt-2 text-xs text-text-muted">
                            {source === 'transaction'
                                ? `Se actualizarán todas las transacciones con descripción similar a "${identifier}".`
                                : 'Se actualizará este elemento específico.'}
                        </p>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-background text-text-main rounded-xl font-medium border border-border hover:bg-border/30 transition"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !selectedCategoryName || !identifier}
                            className="flex-1 px-4 py-3 bg-primary text-primary-fg rounded-xl font-bold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                        >
                            {loading ? 'Guardando...' : 'Asignar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
