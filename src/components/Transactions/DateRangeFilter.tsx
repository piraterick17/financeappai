import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Calendar } from 'lucide-react';

interface DateRange {
  from: string;
  to: string;
}

interface DateRangeFilterProps {
  value: DateRange | null;
  onChange: (range: DateRange | null) => void;
}

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getPresetRange = (preset: string): DateRange => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const to = formatDate(today);
    let from = '';

    switch (preset) {
      case 'today':
        from = to;
        break;
      case 'week':
        const lastWeek = new Date(today);
        lastWeek.setDate(today.getDate() - 7);
        from = formatDate(lastWeek);
        break;
      case 'month':
        const lastMonth = new Date(today);
        lastMonth.setMonth(today.getMonth() - 1);
        from = formatDate(lastMonth);
        break;
      case '3months':
        const last3Months = new Date(today);
        last3Months.setMonth(today.getMonth() - 3);
        from = formatDate(last3Months);
        break;
      case 'year':
        from = `${today.getFullYear()}-01-01`;
        break;
    }

    return { from, to };
  };

  const handlePresetClick = (preset: string) => {
    onChange(getPresetRange(preset));
    setIsOpen(false);
  };

  const handleCustomApply = () => {
    if (customFrom && customTo) {
      onChange({ from: customFrom, to: customTo });
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    onChange(null);
    setCustomFrom('');
    setCustomTo('');
  };

  const getDisplayLabel = () => {
    if (!value) return 'Rango de Fechas';
    const from = new Date(value.from + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
    const to = new Date(value.to + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
    return `${from} - ${to}`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-7 sm:h-8 shrink-0 items-center justify-center gap-x-1 sm:gap-x-2 rounded-lg bg-surface border border-border pl-2 sm:pl-3 pr-1 sm:pr-2 text-text-main hover:bg-primary/10 transition shadow-sm"
      >
        <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
        <p className="text-xs sm:text-sm font-medium whitespace-nowrap">{getDisplayLabel()}</p>
        {value && (
          <span className="flex items-center justify-center w-2 h-2 rounded-full bg-primary"></span>
        )}
        <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4" />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 z-[50] w-[280px] bg-surface border border-border rounded-lg shadow-2xl">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <span className="text-xs font-medium text-primary">Seleccionar Período</span>
            {value && (
              <button
                onClick={handleClear}
                className="text-xs text-text-muted hover:text-text-main flex items-center gap-1 transition"
              >
                <X className="w-3 h-3" />
                Limpiar
              </button>
            )}
          </div>

          <div className="p-3 space-y-2">
            <button
              onClick={() => handlePresetClick('today')}
              className="w-full text-left px-3 py-2 text-sm text-text-main hover:bg-surface/50 rounded transition"
            >
              Hoy
            </button>
            <button
              onClick={() => handlePresetClick('week')}
              className="w-full text-left px-3 py-2 text-sm text-text-main hover:bg-surface/50 rounded transition"
            >
              Última semana
            </button>
            <button
              onClick={() => handlePresetClick('month')}
              className="w-full text-left px-3 py-2 text-sm text-text-main hover:bg-surface/50 rounded transition"
            >
              Último mes
            </button>
            <button
              onClick={() => handlePresetClick('3months')}
              className="w-full text-left px-3 py-2 text-sm text-text-main hover:bg-surface/50 rounded transition"
            >
              Últimos 3 meses
            </button>
            <button
              onClick={() => handlePresetClick('year')}
              className="w-full text-left px-3 py-2 text-sm text-text-main hover:bg-surface/50 rounded transition"
            >
              Este año
            </button>
          </div>

          <div className="p-3 border-t border-border space-y-3">
            <p className="text-xs font-medium text-primary">Rango personalizado</p>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-text-muted mb-1 block">Desde</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded bg-background text-text-main border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="text-xs text-text-muted mb-1 block">Hasta</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded bg-background text-text-main border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <button
                onClick={handleCustomApply}
                disabled={!customFrom || !customTo}
                className="w-full px-3 py-2 text-sm bg-primary text-primary-fg rounded font-bold hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
