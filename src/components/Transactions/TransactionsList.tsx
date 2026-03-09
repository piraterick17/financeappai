import { useEffect, useState, useMemo } from 'react';
import { Search, Download, Upload, Edit, Trash2, PlusCircle, ArrowRightLeft, CheckSquare, Square, SlidersHorizontal, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { AddMovementModal } from './AddMovementModal';
import { ImportTransactionsModal } from './ImportTransactionsModal';
import { EditTransactionModal } from './EditTransactionModal';
import { AddTransferModal } from './AddTransferModal';
import { FilterDropdown } from './FilterDropdown';
import { DateRangeFilter } from './DateRangeFilter';
import { useTransactions, useDeleteTransaction, TransactionWithAccount } from '../../hooks/useTransactions';
import { useAccounts } from '../../hooks/useAccounts';
import { useCategories } from '../../hooks/useCategories';
import { useSuppliers } from '../../hooks/useSuppliers';
import { TransactionsSummary } from './TransactionsSummary';
import { AdvancedFilters } from './AdvancedFilters';
import { BulkActions } from './BulkActions';
import { supabase } from '../../lib/supabase';

export function TransactionsList() {
  const { user } = useAuth();
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [editingTransaction, setEditingTransaction] = useState<TransactionWithAccount | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [dateRange, setDateRange] = useState<{ from: string; to: string } | null>(null);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showProjected, setShowProjected] = useState(false);
  const [onlyRecurring, setOnlyRecurring] = useState(false);
  const [onlyTransfers, setOnlyTransfers] = useState(false);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [showBulkCategoryModal, setShowBulkCategoryModal] = useState(false);
  const [bulkCategoryId, setBulkCategoryId] = useState<string>('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const activeFilterCount = [
    dateRange !== null,
    selectedAccounts.length > 0,
    selectedCategories.length > 0,
    selectedSuppliers.length > 0,
    showProjected,
    onlyRecurring,
    onlyTransfers,
    minAmount !== '',
    maxAmount !== '',
    searchTerm !== '',
  ].filter(Boolean).length;

  const { data: accountsData } = useAccounts(user?.id);
  const { data: categoriesData } = useCategories(user?.id);
  const { data: suppliersData } = useSuppliers(user?.id);

  const { data: transactionsResponse, isLoading } = useTransactions({
    userId: user?.id || '',
    accountIds: selectedAccounts.length > 0 ? selectedAccounts : undefined,
    categories: selectedCategories.length > 0 ? selectedCategories : undefined,
    startDate: dateRange?.from,
    endDate: dateRange?.to,
    searchTerm: debouncedSearchTerm,
    page: currentPage,
    itemsPerPage,
    includeProjected: showProjected,
    isRecurring: onlyRecurring ? true : undefined,
    isTransfer: onlyTransfers ? true : undefined,
    supplierId: selectedSuppliers.length === 1 ? selectedSuppliers[0] : undefined,
    minAmount: minAmount ? parseFloat(minAmount) : undefined,
    maxAmount: maxAmount ? parseFloat(maxAmount) : undefined,
  });

  const deleteTransactionMutation = useDeleteTransaction();

  const accounts = accountsData || [];
  const categories = categoriesData || [];
  const suppliers = suppliersData || [];

  const transactions = useMemo(() => transactionsResponse?.transactions || [], [transactionsResponse]);
  const totalCount = transactionsResponse?.totalCount || 0;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, selectedAccounts, selectedCategories, dateRange, itemsPerPage, showProjected, onlyRecurring, onlyTransfers, selectedSuppliers, minAmount, maxAmount]);

  useEffect(() => {
    if (!isLoading && transactionsResponse) {
      setHasLoadedOnce(true);
    }
  }, [isLoading, transactionsResponse]);

  const summaryData = useMemo(() => {
    const totalIncome = transactions
      .filter(t => t.type === 'income' && !t.is_transfer)
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

    const totalExpenses = transactions
      .filter(t => t.type === 'expense' && !t.is_transfer)
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

    const transactionCount = transactions.length;

    const averageTransaction = transactionCount > 0
      ? (totalIncome + totalExpenses) / transactionCount
      : 0;

    const largestExpense = Math.min(
      ...transactions
        .filter(t => t.type === 'expense')
        .map(t => Number(t.amount)),
      0
    );

    const largestIncome = Math.max(
      ...transactions
        .filter(t => t.type === 'income')
        .map(t => Number(t.amount)),
      0
    );

    const dailyMap = new Map<string, number>();
    let runningBalance = 0;

    [...transactions]
      .sort((a, b) => a.transaction_date.localeCompare(b.transaction_date))
      .forEach(t => {
        if (!t.is_transfer) {
          runningBalance += Number(t.amount);
          dailyMap.set(t.transaction_date, runningBalance);
        }
      });

    const dailyData = Array.from(dailyMap.entries())
      .map(([date, balance]) => ({
        date: new Date(date + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }),
        balance
      }));

    return {
      totalIncome,
      totalExpenses,
      transactionCount,
      averageTransaction,
      largestExpense,
      largestIncome,
      dailyData
    };
  }, [transactions]);

  const selectedAmount = useMemo(() => {
    return Array.from(selectedTransactions)
      .reduce((sum, id) => {
        const transaction = transactions.find(t => t.id === id);
        return sum + (transaction ? Number(transaction.amount) : 0);
      }, 0);
  }, [selectedTransactions, transactions]);

  const transactionsWithBalance = useMemo(() => {
    let runningBalance = 0;
    return transactions.map(t => {
      if (!t.is_transfer) {
        runningBalance += Number(t.amount);
      }
      return {
        ...t,
        runningBalance
      };
    });
  }, [transactions]);

  const handleSelectAll = () => {
    if (selectedTransactions.size === transactions.length) {
      setSelectedTransactions(new Set());
    } else {
      setSelectedTransactions(new Set(transactions.map(t => t.id)));
    }
  };

  const handleSelectTransaction = (id: string) => {
    const newSelection = new Set(selectedTransactions);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedTransactions(newSelection);
  };

  const handleBulkDelete = async () => {
    if (selectedTransactions.size === 0) return;

    const count = selectedTransactions.size;
    if (!confirm(`¿Estás seguro de que deseas eliminar ${count} transaccion${count > 1 ? 'es' : ''}?`)) return;

    try {
      const deletePromises = Array.from(selectedTransactions).map(id =>
        deleteTransactionMutation.mutateAsync(id)
      );

      await Promise.all(deletePromises);
      setSelectedTransactions(new Set());
      toast.success(`${count} transaccion${count > 1 ? 'es eliminadas' : ' eliminada'}`);
    } catch {
      toast.error('Error al eliminar transacciones');
    }
  };

  const handleBulkExport = async () => {
    const XLSX = await import('xlsx');

    const selectedTxs = transactions.filter(t => selectedTransactions.has(t.id));

    const exportData = selectedTxs.map(t => ({
      Fecha: formatDate(t.transaction_date),
      Hora: t.transaction_time || '',
      Descripción: t.description,
      Categoría: t.category || 'Sin categoría',
      Banco: t.accounts ? t.accounts.name : 'N/A',
      Tipo: t.type === 'income' ? 'Ingreso' : 'Gasto',
      Monto: Number(t.amount),
      Proyectado: t.is_projected ? 'Sí' : 'No',
      Transferencia: t.is_transfer ? 'Sí' : 'No',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transacciones');

    const today = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `transacciones_seleccionadas_${today}.xlsx`);
    toast.success(`${selectedTxs.length} transacciones exportadas`);
  };

  const handleBulkChangeCategory = () => {
    if (selectedTransactions.size === 0) return;
    setShowBulkCategoryModal(true);
  };

  const applyBulkCategoryChange = async () => {
    if (!bulkCategoryId || selectedTransactions.size === 0) return;

    try {
      const updates = Array.from(selectedTransactions).map(id =>
        supabase
          .from('transactions')
          // @ts-expect-error
          .update({ category_id: bulkCategoryId })
          .eq('id', id)
      );

      await Promise.all(updates);

      setSelectedTransactions(new Set());
      setShowBulkCategoryModal(false);
      setBulkCategoryId('');
      toast.success('Categorías actualizadas');

      window.location.reload();
    } catch {
      toast.error('Error al actualizar categorías');
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    setDeleteConfirmId(id);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;
    const id = deleteConfirmId;
    setDeleteConfirmId(null);
    try {
      await deleteTransactionMutation.mutateAsync(id);
      toast.success('Transacción eliminada');
    } catch (err: any) {
      console.error('Delete failed:', err);
      toast.error(`Error al eliminar: ${err.message || 'Intenta de nuevo'}`);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date + 'T12:00:00').toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const handleExport = async () => {
    const XLSX = await import('xlsx');

    const exportData = transactions.map(t => ({
      Fecha: formatDate(t.transaction_date),
      Hora: t.transaction_time || '',
      Descripción: t.description,
      Categoría: t.category || 'Sin categoría',
      Cuenta: t.accounts ? `${t.accounts.name}` : 'N/A',
      Tipo: t.type === 'income' ? 'Ingreso' : 'Gasto',
      Monto: Number(t.amount),
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transacciones');

    const today = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `transacciones_${today}.xlsx`);
  };

  const getAccountTypeLabel = (type: string) => {
    const labels = {
      credit: 'Tarjeta de Crédito',
      debit: 'Tarjeta de Débito',
      savings: 'Cuenta de Ahorros',
      investment: 'Cuenta de Inversión',
    };
    return labels[type as keyof typeof labels] || 'Cuenta Corriente';
  };


  if (isLoading && !hasLoadedOnce) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-surface rounded w-1/3"></div>
          <div className="h-64 bg-surface rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:gap-6">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h1 className="text-text-main text-2xl sm:text-3xl lg:text-4xl font-black leading-tight tracking-tight">
            Transacciones
          </h1>
          <div className="flex gap-2 flex-wrap sm:flex-nowrap">
            <button
              onClick={() => setShowMovementModal(true)}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-fg rounded-lg text-sm font-bold hover:bg-opacity-90 transition shadow-md"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Nuevo</span>
            </button>
            <button
              onClick={() => setShowTransferModal(true)}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition"
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>Transferir</span>
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-surface border border-border text-text-main rounded-lg text-sm font-bold hover:bg-background transition"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Importar</span>
            </button>
          </div>
        </header>

        <TransactionsSummary
          totalIncome={summaryData.totalIncome}
          totalExpenses={summaryData.totalExpenses}
          transactionCount={summaryData.transactionCount}
          averageTransaction={summaryData.averageTransaction}
          largestExpense={summaryData.largestExpense}
          largestIncome={summaryData.largestIncome}
          dailyData={summaryData.dailyData}
        />

        {selectedTransactions.size > 0 && (
          <BulkActions
            selectedCount={selectedTransactions.size}
            totalAmount={selectedAmount}
            onDelete={handleBulkDelete}
            onChangeCategory={handleBulkChangeCategory}
            onExport={handleBulkExport}
            onClear={() => setSelectedTransactions(new Set())}
          />
        )}

        <div className="bg-surface rounded-xl border border-border">
          <div className="p-3 sm:p-4 border-b border-border">
            <div className="flex flex-col gap-3 sm:gap-4">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex w-full items-stretch rounded-lg border border-border overflow-hidden">
                    <div className="text-text-muted flex bg-surface items-center justify-center pl-3 sm:pl-4">
                      <Search className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <input
                      className="flex w-full min-w-0 flex-1 resize-none overflow-hidden text-text-main focus:outline-none focus:ring-0 border-none bg-surface h-10 sm:h-12 placeholder:text-text-muted px-3 sm:px-4 text-sm sm:text-base font-normal"
                      placeholder="Buscar transacciones..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <button
                  onClick={handleExport}
                  className="flex items-center justify-center overflow-hidden rounded-lg h-10 sm:h-12 bg-primary text-primary-fg gap-2 text-xs sm:text-sm font-bold tracking-wide px-4 sm:px-5 hover:bg-opacity-90 transition whitespace-nowrap"
                >
                  <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">Exportar Datos</span>
                  <span className="sm:hidden">Exportar</span>
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setFiltersOpen(!filtersOpen)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border font-medium text-sm transition ${filtersOpen || activeFilterCount > 0
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'bg-surface border-border text-text-muted hover:bg-background'
                    }`}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  Filtros
                  {activeFilterCount > 0 && (
                    <span className="bg-primary text-primary-fg text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
                {activeFilterCount > 0 && (
                  <button
                    onClick={() => {
                      setDateRange(null);
                      setSelectedAccounts([]);
                      setSelectedCategories([]);
                      setSelectedSuppliers([]);
                      setShowProjected(false);
                      setOnlyRecurring(false);
                      setOnlyTransfers(false);
                      setMinAmount('');
                      setMaxAmount('');
                      setSearchTerm('');
                    }}
                    className="flex items-center gap-1 px-3 py-2 text-sm text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition font-medium"
                  >
                    <X className="w-3 h-3" />
                    Limpiar filtros
                  </button>
                )}
              </div>

              {/* Desktop inline filters */}
              {filtersOpen && (
                <div className="hidden lg:flex gap-2 sm:gap-3 flex-wrap">
                  <DateRangeFilter
                    value={dateRange}
                    onChange={setDateRange}
                  />
                  <FilterDropdown
                    label="Cuentas/Tarjetas"
                    options={accounts.map(acc => ({
                      value: acc.id,
                      label: `${acc.bank_name} - ${acc.name}`
                    }))}
                    selectedValues={selectedAccounts}
                    onChange={setSelectedAccounts}
                  />
                  <FilterDropdown
                    label="Categorías"
                    options={categories.map(cat => ({
                      value: cat.id,
                      label: cat.name
                    }))}
                    selectedValues={selectedCategories}
                    onChange={setSelectedCategories}
                  />
                  <FilterDropdown
                    label="Proveedores"
                    options={suppliers.map(sup => ({
                      value: sup.id,
                      label: sup.name
                    }))}
                    selectedValues={selectedSuppliers}
                    onChange={setSelectedSuppliers}
                  />
                  <label className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-surface text-text-main cursor-pointer hover:bg-background transition">
                    <input
                      type="checkbox"
                      checked={showProjected}
                      onChange={(e) => setShowProjected(e.target.checked)}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-0"
                    />
                    <span className="text-sm font-medium">Ver Proyecciones</span>
                  </label>
                </div>
              )}

              {filtersOpen && (
                <div className="hidden lg:block">
                  <AdvancedFilters
                    minAmount={minAmount}
                    maxAmount={maxAmount}
                    onlyRecurring={onlyRecurring}
                    onlyTransfers={onlyTransfers}
                    onMinAmountChange={setMinAmount}
                    onMaxAmountChange={setMaxAmount}
                    onOnlyRecurringChange={setOnlyRecurring}
                    onOnlyTransfersChange={setOnlyTransfers}
                  />
                </div>
              )}

              {/* Mobile bottom sheet filters */}
              {filtersOpen && (
                <div className="lg:hidden fixed inset-0 z-50">
                  <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setFiltersOpen(false)} />
                  <div className="absolute bottom-0 left-0 right-0 bg-surface rounded-t-2xl border-t border-border max-h-[85vh] flex flex-col animate-[slideUp_0.3s_ease-out]">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
                      <h2 className="text-lg font-bold text-text-main">Filtros</h2>
                      <button
                        onClick={() => setFiltersOpen(false)}
                        className="p-2 rounded-full hover:bg-background text-text-muted transition"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-5 space-y-5">
                      <div>
                        <label className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2 block">Rango de Fecha</label>
                        <DateRangeFilter value={dateRange} onChange={setDateRange} />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2 block">Cuentas/Tarjetas</label>
                        <FilterDropdown
                          label="Seleccionar cuentas"
                          options={accounts.map(acc => ({ value: acc.id, label: `${acc.bank_name} - ${acc.name}` }))}
                          selectedValues={selectedAccounts}
                          onChange={setSelectedAccounts}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2 block">Categorías</label>
                        <FilterDropdown
                          label="Seleccionar categorías"
                          options={categories.map(cat => ({ value: cat.id, label: cat.name }))}
                          selectedValues={selectedCategories}
                          onChange={setSelectedCategories}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2 block">Proveedores</label>
                        <FilterDropdown
                          label="Seleccionar proveedores"
                          options={suppliers.map(sup => ({ value: sup.id, label: sup.name }))}
                          selectedValues={selectedSuppliers}
                          onChange={setSelectedSuppliers}
                        />
                      </div>
                      <div className="flex flex-col gap-3">
                        <label className="flex items-center gap-3 p-3 rounded-xl border border-border bg-background/50 cursor-pointer active:bg-background transition">
                          <input type="checkbox" checked={showProjected} onChange={(e) => setShowProjected(e.target.checked)} className="w-5 h-5 rounded border-border text-primary focus:ring-primary" />
                          <span className="text-sm font-medium text-text-main">Ver Proyecciones</span>
                        </label>
                        <label className="flex items-center gap-3 p-3 rounded-xl border border-border bg-background/50 cursor-pointer active:bg-background transition">
                          <input type="checkbox" checked={onlyRecurring} onChange={(e) => setOnlyRecurring(e.target.checked)} className="w-5 h-5 rounded border-border text-primary focus:ring-primary" />
                          <span className="text-sm font-medium text-text-main">Solo Recurrentes</span>
                        </label>
                        <label className="flex items-center gap-3 p-3 rounded-xl border border-border bg-background/50 cursor-pointer active:bg-background transition">
                          <input type="checkbox" checked={onlyTransfers} onChange={(e) => setOnlyTransfers(e.target.checked)} className="w-5 h-5 rounded border-border text-primary focus:ring-primary" />
                          <span className="text-sm font-medium text-text-main">Solo Transferencias</span>
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2 block">Monto Mínimo</label>
                          <input type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} placeholder="$0" className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-text-main text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2 block">Monto Máximo</label>
                          <input type="number" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} placeholder="$∞" className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-text-main text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                        </div>
                      </div>
                    </div>
                    <div className="p-5 border-t border-border shrink-0 flex gap-3">
                      <button
                        onClick={() => {
                          setDateRange(null); setSelectedAccounts([]); setSelectedCategories([]); setSelectedSuppliers([]);
                          setShowProjected(false); setOnlyRecurring(false); setOnlyTransfers(false); setMinAmount(''); setMaxAmount(''); setSearchTerm('');
                        }}
                        className="flex-1 py-3 rounded-xl border border-border text-text-muted font-semibold text-sm active:bg-background transition"
                      >
                        Limpiar
                      </button>
                      <button
                        onClick={() => setFiltersOpen(false)}
                        className="flex-1 py-3 rounded-xl bg-primary text-primary-fg font-bold text-sm active:opacity-90 transition"
                      >
                        Aplicar Filtros
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto relative">
            {isLoading && (
              <div className="absolute inset-0 bg-surface/80 flex items-center justify-center z-10">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-text-muted text-sm">Cargando transacciones...</p>
                </div>
              </div>
            )}
            {transactions.length === 0 && !isLoading ? (
              <div className="text-center py-12 sm:py-16">
                <PlusCircle className="w-12 h-12 text-text-muted/40 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-text-main mb-2">Sin transacciones aún</h3>
                <p className="text-text-muted text-sm mb-6 max-w-sm mx-auto">Registra tu primer ingreso o gasto para comenzar a visualizar tu actividad financiera.</p>
                <button
                  onClick={() => setShowMovementModal(true)}
                  className="px-5 py-2.5 bg-primary text-primary-fg rounded-lg font-bold hover:bg-opacity-90 transition text-sm"
                >
                  + Registrar Movimiento
                </button>
              </div>
            ) : (
              <div>
                {/* Mobile Card View */}
                <div className="lg:hidden divide-y divide-border">
                  {transactionsWithBalance.map((transaction) => {
                    const isIncome = transaction.type === 'income';
                    const amount = Number(transaction.amount);
                    const isSelected = selectedTransactions.has(transaction.id);
                    return (
                      <div
                        key={transaction.id}
                        className={`px-4 py-3 ${transaction.is_projected ? 'opacity-70' : ''} ${isSelected ? 'bg-primary/10' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <button
                              onClick={() => handleSelectTransaction(transaction.id)}
                              className="mt-1 text-text-muted hover:text-primary transition p-1"
                            >
                              {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                            </button>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-text-main text-sm truncate">{transaction.description}</p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="text-xs text-text-muted">{formatDate(transaction.transaction_date)}</span>
                                {transaction.category && (
                                  <span className="text-xs text-text-muted capitalize">· {transaction.category}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                {transaction.is_projected && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-500/20 text-orange-400 border border-orange-500/30">Proyectado</span>
                                )}
                                {transaction.is_recurring && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30">Recurrente</span>
                                )}
                                {transaction.is_transfer && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                    <ArrowRightLeft className="w-3 h-3" /> Transferencia
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`font-bold text-sm ${transaction.is_transfer ? 'text-blue-400' : isIncome ? 'text-green-500' : 'text-red-500'}`}>
                              {transaction.is_transfer ? (
                                <span className="inline-flex items-center gap-1"><ArrowRightLeft className="w-3 h-3" />{formatCurrency(Math.abs(amount))}</span>
                              ) : (
                                <>{isIncome ? '+' : '-'}{formatCurrency(Math.abs(amount))}</>
                              )}
                            </p>
                            <div className="flex items-center justify-end gap-1 mt-2">
                              <button onClick={() => setEditingTransaction(transaction)} className="p-2 text-text-muted hover:text-primary transition rounded-lg hover:bg-background">
                                <Edit className="w-4 h-4" />
                              </button>
                              <button onClick={(e) => handleDeleteClick(e, transaction.id)} className="p-2 text-text-muted hover:text-red-500 transition rounded-lg hover:bg-background">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table View */}
                <table className="hidden lg:table w-full text-xs sm:text-sm text-left">
                  <thead className="text-xs text-text-muted uppercase bg-surface/50">
                    <tr>
                      <th className="px-3 sm:px-4 py-2 sm:py-3 w-10">
                        <button onClick={handleSelectAll} className="text-text-muted hover:text-primary transition">
                          {selectedTransactions.size === transactions.length && transactions.length > 0 ? (
                            <CheckSquare className="w-4 h-4" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </th>
                      <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3">Fecha</th>
                      <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3">Descripción</th>
                      <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 hidden md:table-cell">Categoría</th>
                      <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 hidden lg:table-cell">Cuenta</th>
                      <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-right">Monto</th>
                      <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-right hidden xl:table-cell">Saldo</th>
                      <th className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactionsWithBalance.map((transaction, index) => {
                      const isIncome = transaction.type === 'income';
                      const amount = Number(transaction.amount);
                      const isSelected = selectedTransactions.has(transaction.id);
                      return (
                        <tr
                          key={transaction.id}
                          className={`${index < transactions.length - 1 ? 'border-b border-border' : ''
                            } ${transaction.is_projected ? 'bg-surface/30 opacity-70' : ''} ${isSelected ? 'bg-primary/10' : ''
                            } hover:bg-background/50 transition`}
                        >
                          <td className="px-3 sm:px-4 py-3 sm:py-4">
                            <button
                              onClick={() => handleSelectTransaction(transaction.id)}
                              className="text-text-muted hover:text-primary transition"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          </td>
                          <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-text-muted text-xs sm:text-sm">
                            {formatDate(transaction.transaction_date)}
                          </td>
                          <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 font-medium text-text-main text-xs sm:text-sm">
                            <div className="flex items-center gap-2">
                              <div className="max-w-[120px] sm:max-w-none truncate">{transaction.description}</div>
                              {transaction.is_projected && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-500/20 text-orange-400 border border-orange-500/30">
                                  Proyectado
                                </span>
                              )}
                              {transaction.is_recurring && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30">
                                  Recurrente
                                </span>
                              )}
                            </div>
                            <div className="md:hidden text-xs text-text-muted capitalize mt-1">
                              <div className="flex items-center gap-2">
                                <span>{transaction.category}</span>
                                {transaction.is_transfer && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                    <ArrowRightLeft className="w-3 h-3" />
                                    Transferencia
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-text-muted capitalize hidden md:table-cell text-xs sm:text-sm">
                            <div className="flex items-center gap-2">
                              <span>{transaction.category}</span>
                              {transaction.is_transfer && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                  <ArrowRightLeft className="w-3 h-3" />
                                  Transferencia
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-text-muted hidden lg:table-cell text-xs sm:text-sm">
                            {transaction.accounts
                              ? getAccountTypeLabel(transaction.accounts.type)
                              : 'N/A'}
                          </td>
                          <td
                            className={`px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-right font-medium text-xs sm:text-sm ${transaction.is_transfer
                              ? 'text-blue-400'
                              : isIncome
                                ? 'text-green-500'
                                : 'text-red-500'
                              }`}
                          >
                            {transaction.is_transfer ? (
                              <span className="inline-flex items-center gap-1">
                                <ArrowRightLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                                {formatCurrency(Math.abs(amount))}
                              </span>
                            ) : (
                              <>
                                {isIncome ? '+' : '-'}
                                {formatCurrency(Math.abs(amount))}
                              </>
                            )}
                          </td>
                          <td className={`px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-right font-semibold text-xs sm:text-sm hidden xl:table-cell ${transaction.runningBalance >= 0 ? 'text-primary' : 'text-red-400'
                            }`}>
                            {formatCurrency(transaction.runningBalance)}
                          </td>
                          <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-right">
                            <button
                              onClick={() => setEditingTransaction(transaction)}
                              className="p-1 text-text-muted hover:text-primary transition"
                            >
                              <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
                            </button>
                            <button
                              onClick={(e) => handleDeleteClick(e, transaction.id)}
                              className="p-1 text-text-muted hover:text-red-500 transition"
                            >
                              <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {totalCount > 0 && (
              <div className="px-4 py-3 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-sm text-text-muted">
                  <span>Mostrar</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="px-2 py-1 rounded bg-surface text-text-main border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span>
                    Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, totalCount)} - {Math.min(currentPage * itemsPerPage, totalCount)} de {totalCount}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 rounded bg-surface text-text-main hover:bg-surface/80 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
                  >
                    Primera
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 rounded bg-surface text-text-main hover:bg-surface/80 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
                  >
                    Anterior
                  </button>
                  <span className="px-3 py-1 text-sm text-text-muted">
                    Página {currentPage} de {Math.ceil(totalCount / itemsPerPage)}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalCount / itemsPerPage), prev + 1))}
                    disabled={currentPage >= Math.ceil(totalCount / itemsPerPage)}
                    className="px-3 py-1 rounded bg-surface text-text-main hover:bg-surface/80 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
                  >
                    Siguiente
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.ceil(totalCount / itemsPerPage))}
                    disabled={currentPage >= Math.ceil(totalCount / itemsPerPage)}
                    className="px-3 py-1 rounded bg-surface text-text-main hover:bg-surface/80 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
                  >
                    Última
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showMovementModal && (
        <AddMovementModal
          onClose={() => setShowMovementModal(false)}
        />
      )}

      {showTransferModal && (
        <AddTransferModal
          onClose={() => setShowTransferModal(false)}
          onSuccess={() => {
            setShowTransferModal(false);
          }}
        />
      )}

      {showImportModal && (
        <ImportTransactionsModal
          accounts={accounts}
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            setShowImportModal(false);
          }}
        />
      )}

      {editingTransaction && (
        <EditTransactionModal
          transaction={editingTransaction}
          onClose={() => setEditingTransaction(null)}
          onSuccess={() => {
            setEditingTransaction(null);
          }}
        />
      )}

      {showBulkCategoryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded-2xl max-w-md w-full p-6 border border-border shadow-2xl">
            <h3 className="text-xl font-bold text-text-main mb-4">Cambiar Categoría</h3>
            <p className="text-sm text-text-muted mb-6">
              Selecciona una nueva categoría para {selectedTransactions.size} transaccion{selectedTransactions.size > 1 ? 'es' : ''}
            </p>

            <select
              value={bulkCategoryId}
              onChange={(e) => setBulkCategoryId(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-background text-text-main border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 mb-6"
            >
              <option value="">Selecciona una categoría</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowBulkCategoryModal(false);
                  setBulkCategoryId('');
                }}
                className="flex-1 px-4 py-2 rounded-lg bg-surface border border-border text-text-main font-medium hover:bg-background transition"
              >
                Cancelar
              </button>
              <button
                onClick={applyBulkCategoryChange}
                disabled={!bulkCategoryId}
                className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-fg font-bold hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDeleteConfirmId(null)}>
          <div className="bg-surface rounded-2xl p-6 shadow-xl border border-border max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-500/20 rounded-full">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-text-main">Eliminar transacción</h3>
            </div>
            <p className="text-text-muted text-sm mb-6">
              ¿Estás seguro de que deseas eliminar esta transacción? Esta acción se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-4 py-2.5 rounded-lg bg-surface border border-border text-text-main font-medium hover:bg-background transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-500 text-white font-bold hover:bg-red-600 transition"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
