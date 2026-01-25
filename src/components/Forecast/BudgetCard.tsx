import { TrendingUp, TrendingDown, AlertCircle, Edit, Trash2 } from 'lucide-react';

interface BudgetCardProps {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  spent: number;
  limit: number;
  percentageUsed: number;
  onEdit: (categoryId: string, amount: number) => void;
  onDelete: (categoryId: string) => void;
}

export function BudgetCard({
  categoryId,
  categoryName,
  categoryColor,
  spent,
  limit,
  percentageUsed,
  onEdit,
  onDelete,
}: BudgetCardProps) {
  const isOverBudget = percentageUsed > 100;
  const isWarning = percentageUsed >= 80 && percentageUsed <= 100;
  const isGood = percentageUsed < 80;

  const remaining = limit - spent;
  const barWidth = Math.min(percentageUsed, 100);

  const getStatusColor = () => {
    if (isOverBudget) return 'bg-red-500';
    if (isWarning) return 'bg-yellow-500';
    return 'bg-primary';
  };

  const getStatusBorderColor = () => {
    if (isOverBudget) return 'border-red-500/50';
    if (isWarning) return 'border-yellow-500/50';
    return 'border-primary/30';
  };

  const getStatusTextColor = () => {
    if (isOverBudget) return 'text-red-400';
    if (isWarning) return 'text-yellow-500';
    return 'text-primary';
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(value);
  };

  return (
    <div className={`bg-[#1c3a27] rounded-xl p-6 border-2 ${getStatusBorderColor()} hover:border-primary/50 transition-all`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: categoryColor + '20' }}
          >
            <div
              className="w-6 h-6 rounded-full"
              style={{ backgroundColor: categoryColor }}
            />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{categoryName}</h3>
            <p className="text-sm text-gray-400">
              {formatCurrency(spent)} de {formatCurrency(limit)}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onEdit(categoryId, limit)}
            className="p-2 text-gray-400 hover:text-primary rounded-lg transition"
            title="Editar límite"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(categoryId)}
            className="p-2 text-gray-400 hover:text-red-500 rounded-lg transition"
            title="Eliminar límite"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="h-3 bg-[#23482f] rounded-full overflow-hidden">
          <div
            className={`h-full ${getStatusColor()} transition-all duration-500 ease-out rounded-full`}
            style={{ width: `${barWidth}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isOverBudget && (
              <>
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span className={`text-sm font-semibold ${getStatusTextColor()}`}>
                  Excedido por {formatCurrency(Math.abs(remaining))}
                </span>
              </>
            )}
            {isWarning && (
              <>
                <TrendingUp className="w-4 h-4 text-yellow-500" />
                <span className={`text-sm font-semibold ${getStatusTextColor()}`}>
                  Quedan {formatCurrency(remaining)}
                </span>
              </>
            )}
            {isGood && (
              <>
                <TrendingDown className="w-4 h-4 text-primary" />
                <span className={`text-sm font-semibold ${getStatusTextColor()}`}>
                  Quedan {formatCurrency(remaining)}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-2xl font-black ${getStatusTextColor()}`}>
              {percentageUsed.toFixed(0)}%
            </span>
          </div>
        </div>

        {isOverBudget && (
          <div className="mt-3 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
            <p className="text-xs text-red-400">
              ⚠️ Has excedido tu presupuesto mensual en esta categoría
            </p>
          </div>
        )}

        {isWarning && (
          <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <p className="text-xs text-yellow-500/80">
              ⚡ Te estás acercando al límite de tu presupuesto
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
