import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useSuppliers } from '../../hooks/useSuppliers';
import { Database } from '../../lib/database.types';

type Account = Database['public']['Tables']['accounts']['Row'];

interface AddCreditPurchaseModalProps {
  onClose: () => void;
  onSuccess: () => void;
  inline?: boolean;
}

export function AddCreditPurchaseModal({ onClose, onSuccess, inline = false }: AddCreditPurchaseModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const { data: suppliers = [], isLoading: suppliersLoading } = useSuppliers(user?.id);

  const [formData, setFormData] = useState({
    purchase_date: new Date().toISOString().split('T')[0],
    supplier_id: '',
    description: '',
    total_amount: '',
    account_id: '',
    installments: '1',
    interest_rate: '0',
    first_payment_date: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (user) {
      loadAccounts();
    }
  }, [user]);

  useEffect(() => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);
    setFormData((prev) => ({
      ...prev,
      first_payment_date: nextMonth.toISOString().split('T')[0],
    }));
  }, []);

  const loadAccounts = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', 'credit')
      .eq('is_active', true)
      .order('name');

    if (data) {
      setAccounts(data);
      if (data.length > 0 && !formData.account_id) {
        setFormData((prev) => ({ ...prev, account_id: data[0].id }));
      }
    }
  };

  const calculateInstallmentAmount = () => {
    const total = parseFloat(formData.total_amount) || 0;
    const installments = parseInt(formData.installments) || 1;
    const rate = parseFloat(formData.interest_rate) || 0;

    if (rate === 0) {
      return total / installments;
    }

    const monthlyRate = rate / 100 / 12;
    const installmentAmount =
      (total * monthlyRate * Math.pow(1 + monthlyRate, installments)) /
      (Math.pow(1 + monthlyRate, installments) - 1);

    return installmentAmount;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError('');
    setSuccessMessage('');

    const installmentAmount = calculateInstallmentAmount();

    const { data: creditPurchase, error: dbError } = await supabase
      .from('credit_purchases')
      .insert({
        user_id: user.id,
        account_id: formData.account_id,
        description: formData.description,
        total_amount: parseFloat(formData.total_amount),
        installments: parseInt(formData.installments),
        installment_amount: installmentAmount,
        interest_rate: parseFloat(formData.interest_rate),
        first_payment_date: formData.first_payment_date,
        remaining_installments: parseInt(formData.installments),
        purchase_date: formData.purchase_date,
        supplier_id: formData.supplier_id || null,
      })
      .select()
      .single();

    if (dbError) {
      setError(dbError.message);
      setLoading(false);
      return;
    }

    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'generate_installment_transactions',
      { p_credit_purchase_id: creditPurchase.id }
    );

    if (rpcError) {
      setError(`Compra creada pero error al generar cuotas: ${rpcError.message}`);
      setLoading(false);
      return;
    }

    if (rpcResult && !rpcResult.success) {
      setError(`Error al generar cuotas: ${rpcResult.error}`);
      setLoading(false);
      return;
    }

    const transactionsCreated = rpcResult?.created || parseInt(formData.installments);
    setSuccessMessage(`Compra registrada exitosamente. ${transactionsCreated} cuota${transactionsCreated !== 1 ? 's' : ''} generada${transactionsCreated !== 1 ? 's' : ''}.`);

    queryClient.invalidateQueries({ queryKey: ['transactions'] });
    queryClient.invalidateQueries({ queryKey: ['accounts'] });

    setTimeout(() => {
      onSuccess();
    }, 1500);
  };

  if (accounts.length === 0 && !inline) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
        <div className="bg-surface rounded-xl max-w-md w-full p-6 border border-border">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-text-main">Compra a Crédito</h3>
            <button onClick={onClose} className="p-2 hover:bg-surface/80 rounded-lg transition">
              <X className="w-5 h-5 text-text-muted" />
            </button>
          </div>
          <p className="text-text-main text-center py-8">
            Necesitas tener al menos una tarjeta de crédito registrada para agregar compras a
            crédito.
          </p>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-primary hover:bg-opacity-90 text-primary-fg font-bold rounded-lg transition"
          >
            Entendido
          </button>
        </div>
      </div>
    );
  }

  const installmentAmount = calculateInstallmentAmount();
  const totalWithInterest = installmentAmount * parseInt(formData.installments || '1');

  const formContent = (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="p-3 bg-red-900/20 border border-red-500/50 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-green-900/20 border border-green-500/50 rounded-lg">
          <p className="text-sm text-green-400">{successMessage}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block mb-2 text-sm font-medium text-text-muted">
            Fecha de Compra
          </label>
          <input
            type="date"
            value={formData.purchase_date}
            onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
            required
            className="block w-full rounded-lg border border-border bg-transparent text-text-main focus:ring-primary focus:border-primary px-3 py-2"
          />
        </div>

        <div>
          <label className="block mb-2 text-sm font-medium text-text-muted">
            Proveedor
          </label>
          <select
            value={formData.supplier_id}
            onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
            disabled={suppliersLoading}
            className="block w-full rounded-lg border border-border bg-surface text-text-main focus:ring-primary focus:border-primary px-3 py-2 disabled:opacity-50"
          >
            {suppliersLoading ? (
              <option value="">Cargando...</option>
            ) : (
              <>
                <option value="">Sin proveedor</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>
      </div>

      <div>
        <label className="block mb-2 text-sm font-medium text-text-muted">
          Descripción
        </label>
        <input
          type="text"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          required
          className="block w-full rounded-lg border border-border bg-transparent text-text-main focus:ring-primary focus:border-primary px-3 py-2"
          placeholder="Ej: Laptop Dell XPS 15"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block mb-2 text-sm font-medium text-text-muted">
            Monto Total
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.total_amount}
            onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
            required
            className="block w-full rounded-lg border border-border bg-transparent text-text-main focus:ring-primary focus:border-primary px-3 py-2"
            placeholder="15000.00"
          />
        </div>

        <div>
          <label className="block mb-2 text-sm font-medium text-text-muted">
            Tarjeta de Crédito
          </label>
          <select
            value={formData.account_id}
            onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
            className="block w-full rounded-lg border border-border bg-surface text-text-main focus:ring-primary focus:border-primary px-3 py-2"
            required
          >
            <option value="">Selecciona tarjeta</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.bank_name} - {account.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block mb-2 text-sm font-medium text-text-muted">
            Meses (Plazos)
          </label>
          <select
            value={formData.installments}
            onChange={(e) => setFormData({ ...formData, installments: e.target.value })}
            className="block w-full rounded-lg border border-border bg-surface text-text-main focus:ring-primary focus:border-primary px-3 py-2"
          >
            <option value="1">1 mes</option>
            <option value="3">3 meses</option>
            <option value="6">6 meses</option>
            <option value="9">9 meses</option>
            <option value="12">12 meses</option>
            <option value="13">13 meses</option>
            <option value="18">18 meses</option>
            <option value="24">24 meses</option>
            <option value="36">36 meses</option>
            <option value="48">48 meses</option>
          </select>
        </div>

        <div>
          <label className="block mb-2 text-sm font-medium text-text-muted">
            Tasa de Interés (% anual)
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.interest_rate}
            onChange={(e) => setFormData({ ...formData, interest_rate: e.target.value })}
            className="block w-full rounded-lg border border-border bg-transparent text-text-main focus:ring-primary focus:border-primary px-3 py-2"
            placeholder="0.00"
          />
        </div>
      </div>

      <div>
        <label className="block mb-2 text-sm font-medium text-text-muted">
          Fecha de Primer Pago
        </label>
        <input
          type="date"
          value={formData.first_payment_date}
          onChange={(e) => setFormData({ ...formData, first_payment_date: e.target.value })}
          required
          className="block w-full rounded-lg border border-border bg-transparent text-text-main focus:ring-primary focus:border-primary px-3 py-2"
        />
      </div>

      {formData.total_amount && formData.installments && (
        <div className="p-4 bg-surface/50 rounded-lg border border-border">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-muted">Cuota mensual:</span>
              <span className="font-medium text-text-main">
                {new Intl.NumberFormat('es-MX', {
                  style: 'currency',
                  currency: 'MXN',
                }).format(installmentAmount)}
              </span>
            </div>
            {parseFloat(formData.interest_rate) > 0 && (
              <>
                <div className="flex justify-between">
                  <span className="text-text-muted">Total a pagar:</span>
                  <span className="font-medium text-text-main">
                    {new Intl.NumberFormat('es-MX', {
                      style: 'currency',
                      currency: 'MXN',
                    }).format(totalWithInterest)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Intereses:</span>
                  <span className="font-medium text-red-400">
                    {new Intl.NumberFormat('es-MX', {
                      style: 'currency',
                      currency: 'MXN',
                    }).format(totalWithInterest - parseFloat(formData.total_amount))}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center h-11 px-6 mt-2 bg-primary/90 text-primary-fg rounded-lg text-sm font-bold hover:bg-primary transition disabled:opacity-50"
      >
        {loading ? 'Registrando...' : 'Registrar Compra'}
      </button>
    </form>
  );

  if (inline) {
    return formContent;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
      <div className="bg-surface rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 border border-border">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-text-main">Compra a Crédito</h3>
          <button onClick={onClose} className="p-2 hover:bg-surface/80 rounded-lg transition">
            <X className="w-5 h-5 text-text-muted" />
          </button>
        </div>
        {formContent}
      </div>
    </div>
  );
}
