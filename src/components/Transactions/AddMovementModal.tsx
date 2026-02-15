import { useState, useEffect, useMemo } from 'react';
import { X, Calendar, CreditCard, ArrowUpCircle, ArrowDownCircle, Store, Tag, DollarSign, Clock, Plus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useAccounts } from '../../hooks/useAccounts';
import { useCategories } from '../../hooks/useCategories';
import { useSuppliers } from '../../hooks/useSuppliers';
import { AddCategoryModal } from '../Administration/AddCategoryModal';
import { AddSupplierModal } from '../Administration/AddSupplierModal';
import { toast } from 'sonner';

interface AddMovementModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddMovementModal({ onClose, onSuccess }: AddMovementModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: accountsData } = useAccounts(user?.id);
  const { data: categoriesData } = useCategories(user?.id);
  const { data: suppliersData } = useSuppliers(user?.id);

  const accounts = accountsData || [];
  const categories = categoriesData || [];
  const suppliers = suppliersData || [];

  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [isCredit, setIsCredit] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);

  const [formData, setFormData] = useState({
    account_id: '',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    category_id: '',
    supplier_id: '',
    installments: '1',
    interest_rate: '0',
    first_payment_date: '',
  });

  useEffect(() => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);
    setFormData(prev => ({
      ...prev,
      first_payment_date: nextMonth.toISOString().split('T')[0]
    }));
  }, []);

  const availableAccounts = useMemo(() => {
    if (type === 'income') return accounts;
    if (isCredit) return accounts.filter(a => a.type === 'credit');
    return accounts;
  }, [accounts, type, isCredit]);

  useEffect(() => {
    if (availableAccounts.length > 0) {
      const currentAccountIsValid = availableAccounts.some(a => a.id === formData.account_id);

      if (!formData.account_id || !currentAccountIsValid) {
        setFormData(prev => ({ ...prev, account_id: availableAccounts[0].id }));
      }
    }
  }, [availableAccounts, formData.account_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const amountVal = parseFloat(formData.amount);
    if (isNaN(amountVal) || amountVal <= 0) {
      toast.error('El monto debe ser mayor a 0');
      return;
    }
    if (!formData.account_id) {
      toast.error('Debes seleccionar una cuenta');
      return;
    }
    setLoading(true);
    try {
      if (isCredit && type === 'expense') {
        const installments = parseInt(formData.installments);
        const interestRate = parseFloat(formData.interest_rate);

        let installmentAmount = amountVal / installments;
        if (interestRate > 0) {
          const monthlyRate = interestRate / 100 / 12;
          installmentAmount = (amountVal * monthlyRate * Math.pow(1 + monthlyRate, installments)) / (Math.pow(1 + monthlyRate, installments) - 1);
        }

        const { data: creditPurchase, error: cpError } = await supabase
          .from('credit_purchases')
          .insert({
            user_id: user.id,
            account_id: formData.account_id,
            description: formData.description,
            total_amount: amountVal,
            installments: installments,
            installment_amount: installmentAmount,
            interest_rate: interestRate,
            first_payment_date: formData.first_payment_date,
            purchase_date: formData.date,
            supplier_id: formData.supplier_id || null,
            category_id: formData.category_id || null,
            remaining_installments: installments,
          } as any)
          .select()
          .single();
        if (cpError) throw cpError;

        // @ts-ignore
        const { error: rpcError } = await supabase.rpc('generate_installment_transactions' as any, {
          p_credit_purchase_id: (creditPurchase as any).id
        });
        if (rpcError) throw rpcError;

        toast.success(`Compra a ${installments} meses registrada`);
      } else {
        const finalAmount = type === 'expense' ? -Math.abs(amountVal) : Math.abs(amountVal);
        const selectedCategory = categories.find(c => c.id === formData.category_id);
        const { error: txError } = await supabase.from('transactions').insert({
          user_id: user.id,
          account_id: formData.account_id,
          type: type,
          amount: finalAmount,
          description: formData.description,
          transaction_date: formData.date,
          category: selectedCategory?.name || null,
          category_id: formData.category_id || null,
          supplier_id: (type === 'expense' && formData.supplier_id) ? formData.supplier_id : null,
          is_recurring: false
        } as any);
        if (txError) throw txError;

        toast.success(type === 'income' ? 'Ingreso registrado' : 'Gasto registrado');
      }

      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });

      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Error al registrar el movimiento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
      <div className="bg-surface rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 border border-border shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-text-main">Nuevo Movimiento</h3>
          <button onClick={onClose} className="p-2 hover:bg-background rounded-lg transition text-text-muted">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">

          <div className="grid grid-cols-2 gap-1 bg-background p-1 rounded-xl">
            <button
              type="button"
              onClick={() => { setType('expense'); setIsCredit(false); }}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg font-medium transition-all ${type === 'expense'
                ? 'bg-red-500 text-white shadow-md'
                : 'text-text-muted hover:text-text-main'
                }`}
            >
              <ArrowDownCircle className="w-4 h-4" /> Gasto
            </button>
            <button
              type="button"
              onClick={() => { setType('income'); setIsCredit(false); }}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg font-medium transition-all ${type === 'income'
                ? 'bg-[#11d452] text-black shadow-md'
                : 'text-text-muted hover:text-text-main'
                }`}
            >
              <ArrowUpCircle className="w-4 h-4" /> Ingreso
            </button>
          </div>

          {type === 'expense' && (
            <div className="flex items-center gap-3 p-3 bg-background/50 rounded-lg border border-border">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isCredit ? 'bg-primary/20 text-primary' : 'bg-gray-800 text-gray-500'}`}>
                <CreditCard className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-text-main">Compra a Crédito</p>
                <p className="text-xs text-text-muted">Pagar a meses sin intereses</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={isCredit} onChange={(e) => setIsCredit(e.target.checked)} />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase">Monto</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">
                <DollarSign className="w-5 h-5" />
              </span>
              <input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full pl-12 pr-4 py-3 bg-background border border-border rounded-xl text-text-main focus:ring-2 focus:ring-primary focus:border-transparent text-lg font-bold"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase">Fecha</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
                  <Calendar className="w-4 h-4" />
                </span>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-text-main text-sm focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase">Descripción</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-text-main text-sm focus:ring-2 focus:ring-primary"
                placeholder="Ej: Supermercado"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase">Cuenta</label>
              <select
                value={formData.account_id}
                onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-text-main text-sm focus:ring-2 focus:ring-primary"
                required
              >
                {availableAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.bank_name} - {acc.name}
                  </option>
                ))}
                {availableAccounts.length === 0 && <option value="" disabled>No hay cuentas disponibles</option>}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase">Categoría</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
                    <Tag className="w-4 h-4" />
                  </span>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-text-main text-sm focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Sin categoría</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddCategoryModal(true)}
                  className="p-2.5 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-xl transition flex items-center justify-center"
                  title="Agregar categoría"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {type === 'expense' && (
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase">Proveedor</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
                    <Store className="w-4 h-4" />
                  </span>
                  <select
                    value={formData.supplier_id}
                    onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-text-main text-sm focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Seleccionar Proveedor</option>
                    {suppliers.map(sup => (
                      <option key={sup.id} value={sup.id}>{sup.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddSupplierModal(true)}
                  className="p-2.5 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-xl transition flex items-center justify-center"
                  title="Agregar proveedor"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {isCredit && type === 'expense' && (
            <div className="p-4 bg-[#1c3a27]/30 border border-primary/20 rounded-xl space-y-4 animate-in fade-in slide-in-from-top-2">
              <h4 className="text-sm font-bold text-primary flex items-center gap-2">
                <Clock className="w-4 h-4" /> Detalles de Plazos
              </h4>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Plazo (Meses)</label>
                  <select
                    value={formData.installments}
                    onChange={(e) => setFormData({ ...formData, installments: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-main text-sm"
                  >
                    {[1, 3, 6, 9, 12, 13, 15, 18, 24, 36, 48].map(m => (
                      <option key={m} value={m}>{m} Meses</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Primer Pago</label>
                  <input
                    type="date"
                    value={formData.first_payment_date}
                    onChange={(e) => setFormData({ ...formData, first_payment_date: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-main text-sm"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-border text-text-muted font-medium rounded-xl hover:bg-background transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-primary text-[#112217] font-bold rounded-xl hover:bg-opacity-90 transition disabled:opacity-50 shadow-lg shadow-primary/20"
            >
              {loading ? 'Guardando...' : 'Guardar Movimiento'}
            </button>
          </div>
        </form>
      </div>

      {showAddCategoryModal && (
        <AddCategoryModal
          onClose={() => setShowAddCategoryModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            setShowAddCategoryModal(false);
            toast.success('Categoría creada');
          }}
        />
      )}

      {showAddSupplierModal && (
        <AddSupplierModal
          onClose={() => setShowAddSupplierModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
            setShowAddSupplierModal(false);
            toast.success('Proveedor creado');
          }}
        />
      )}
    </div>
  );
}
