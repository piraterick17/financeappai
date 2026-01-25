import { Trash2, Tag, Download, X } from 'lucide-react';

interface BulkActionsProps {
  selectedCount: number;
  totalAmount: number;
  onDelete: () => void;
  onChangeCategory: () => void;
  onExport: () => void;
  onClear: () => void;
}

export function BulkActions({
  selectedCount,
  totalAmount,
  onDelete,
  onChangeCategory,
  onExport,
  onClear,
}: BulkActionsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  if (selectedCount === 0) return null;

  return (
    <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div className="flex items-center gap-4">
        <div>
          <p className="text-sm font-bold text-text-main">
            {selectedCount} transaccion{selectedCount > 1 ? 'es' : ''} seleccionada{selectedCount > 1 ? 's' : ''}
          </p>
          <p className="text-xs text-text-muted">
            Total: <span className="font-semibold text-primary">{formatCurrency(Math.abs(totalAmount))}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto">
        <button
          onClick={onChangeCategory}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-surface border border-border text-text-main rounded-lg text-xs font-medium hover:bg-background transition flex-1 sm:flex-initial"
        >
          <Tag className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Categoría</span>
        </button>

        <button
          onClick={onExport}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-surface border border-border text-text-main rounded-lg text-xs font-medium hover:bg-background transition flex-1 sm:flex-initial"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Exportar</span>
        </button>

        <button
          onClick={onDelete}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/30 transition flex-1 sm:flex-initial"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Eliminar</span>
        </button>

        <button
          onClick={onClear}
          className="flex items-center justify-center p-1.5 bg-surface border border-border text-text-muted rounded-lg hover:bg-background transition"
          title="Limpiar selección"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
