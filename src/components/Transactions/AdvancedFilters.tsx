import { DollarSign } from 'lucide-react';

interface AdvancedFiltersProps {
  minAmount: string;
  maxAmount: string;
  onlyRecurring: boolean;
  onlyTransfers: boolean;
  onMinAmountChange: (value: string) => void;
  onMaxAmountChange: (value: string) => void;
  onOnlyRecurringChange: (value: boolean) => void;
  onOnlyTransfersChange: (value: boolean) => void;
}

export function AdvancedFilters({
  minAmount,
  maxAmount,
  onlyRecurring,
  onlyTransfers,
  onMinAmountChange,
  onMaxAmountChange,
  onOnlyRecurringChange,
  onOnlyTransfersChange,
}: AdvancedFiltersProps) {
  return (
    <div className="flex gap-2 sm:gap-3 flex-wrap">
      <div className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-2">
        <DollarSign className="w-4 h-4 text-text-muted" />
        <input
          type="number"
          placeholder="Monto mín"
          value={minAmount}
          onChange={(e) => onMinAmountChange(e.target.value)}
          className="w-20 sm:w-24 bg-transparent text-text-main text-sm focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-2">
        <DollarSign className="w-4 h-4 text-text-muted" />
        <input
          type="number"
          placeholder="Monto máx"
          value={maxAmount}
          onChange={(e) => onMaxAmountChange(e.target.value)}
          className="w-20 sm:w-24 bg-transparent text-text-main text-sm focus:outline-none"
        />
      </div>

      <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-surface text-text-main cursor-pointer hover:bg-background transition">
        <input
          type="checkbox"
          checked={onlyRecurring}
          onChange={(e) => onOnlyRecurringChange(e.target.checked)}
          className="w-4 h-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-0"
        />
        <span className="text-sm font-medium">Recurrentes</span>
      </label>

      <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-surface text-text-main cursor-pointer hover:bg-background transition">
        <input
          type="checkbox"
          checked={onlyTransfers}
          onChange={(e) => onOnlyTransfersChange(e.target.checked)}
          className="w-4 h-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-0"
        />
        <span className="text-sm font-medium">Transferencias</span>
      </label>
    </div>
  );
}
