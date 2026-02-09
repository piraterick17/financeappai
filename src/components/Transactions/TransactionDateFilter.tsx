import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';

export type DateRangeOption = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

interface TransactionDateFilterProps {
    onRangeChange: (startDate: string, endDate: string) => void;
}

export function TransactionDateFilter({ onRangeChange }: TransactionDateFilterProps) {
    const [selectedOption, setSelectedOption] = useState<DateRangeOption>('month');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        applyFilter(selectedOption);
    }, []);

    const applyFilter = (option: DateRangeOption) => {
        const now = new Date();
        let start = new Date();
        let end = new Date();

        switch (option) {
            case 'today':
                // Start/End are already now
                break;
            case 'yesterday':
                start.setDate(now.getDate() - 1);
                end.setDate(now.getDate() - 1);
                break;
            case 'week':
                // Start is monday of current week
                const day = now.getDay();
                const diff = now.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
                start.setDate(diff);
                end = now; // Until today
                break;
            case 'month':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                break;
            case 'custom':
                if (!customStart || !customEnd) return;
                return; // Handle separately
        }

        const startStr = start.toISOString().split('T')[0];
        const endStr = end.toISOString().split('T')[0];

        onRangeChange(startStr, endStr);
        setSelectedOption(option);
        setIsOpen(false);
    };

    const handleCustomApply = () => {
        if (customStart && customEnd) {
            onRangeChange(customStart, customEnd);
            setSelectedOption('custom');
            setIsOpen(false);
        }
    };

    const labels: Record<DateRangeOption, string> = {
        today: 'Hoy',
        yesterday: 'Ayer',
        week: 'Esta Semana',
        month: 'Este Mes',
        custom: 'Rango Personalizado'
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg text-text-main hover:bg-background transition text-sm font-medium"
            >
                <CalendarIcon className="w-4 h-4 text-primary" />
                <span>{labels[selectedOption]}</span>
                <ChevronDown className="w-4 h-4 text-text-muted" />
            </button>

            {isOpen && (
                <div className="absolute top-full mt-2 w-72 bg-surface border border-border rounded-xl shadow-xl z-50 p-2 left-1/2 -translate-x-1/2 sm:left-auto sm:right-0 sm:translate-x-0">
                    <div className="space-y-1 mb-3">
                        {(['today', 'yesterday', 'week', 'month'] as DateRangeOption[]).map((opt) => (
                            <button
                                key={opt}
                                onClick={() => applyFilter(opt)}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${selectedOption === opt
                                    ? 'bg-primary/20 text-primary font-medium'
                                    : 'text-text-main hover:bg-background'
                                    }`}
                            >
                                {labels[opt]}
                            </button>
                        ))}
                    </div>

                    <div className="border-t border-border pt-3 px-1">
                        <p className="text-xs text-text-muted mb-2 font-medium">Rango Personalizado</p>
                        <div className="grid grid-cols-2 gap-2 mb-2">
                            <input
                                type="date"
                                value={customStart}
                                onChange={(e) => setCustomStart(e.target.value)}
                                className="w-full px-2 py-1.5 bg-background border border-border rounded text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            <input
                                type="date"
                                value={customEnd}
                                onChange={(e) => setCustomEnd(e.target.value)}
                                className="w-full px-2 py-1.5 bg-background border border-border rounded text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                        </div>
                        <button
                            onClick={handleCustomApply}
                            disabled={!customStart || !customEnd}
                            className="w-full py-1.5 bg-primary text-primary-fg rounded text-xs font-bold hover:bg-opacity-90 disabled:opacity-50"
                        >
                            Aplicar Rango
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
