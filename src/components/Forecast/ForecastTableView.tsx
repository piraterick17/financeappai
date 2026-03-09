import { useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useForecastTable, MonthColumn, CategoryGroup, ForecastRow } from '../../hooks/useForecastTable';
import { CategoryAssignModal } from './CategoryAssignModal';
import { format, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    CreditCard,
    Home,
    Wifi,
    ShoppingCart,
    Utensils,
    Car,
    Heart,
    Briefcase,
    DollarSign,
    TrendingDown,
    TrendingUp,
    ChevronRight,
    ChevronDown,
    Calendar,
    Pencil,
} from 'lucide-react';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
    'Vivienda': Home,
    'Alquiler': Home,
    'Hipoteca': Home,
    'Servicios': Wifi,
    'Internet': Wifi,
    'Comida': Utensils,
    'Alimentación': Utensils,
    'Restaurantes': Utensils,
    'Transporte': Car,
    'Salud': Heart,
    'Trabajo': Briefcase,
    'Compras': ShoppingCart,
    'Tarjeta': CreditCard,
    'Crédito': CreditCard,
    'Préstamo': CreditCard,
    'Deuda': CreditCard,
};

function getIconForCategory(name: string): React.ElementType {
    for (const [key, Icon] of Object.entries(CATEGORY_ICONS)) {
        if (name.toLowerCase().includes(key.toLowerCase())) return Icon;
    }
    return DollarSign;
}

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 2,
    }).format(amount);

function generateMonthOptions() {
    const options: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = -12; i <= 24; i++) {
        const d = addMonths(now, i);
        const value = format(d, 'yyyy-MM');
        const label = format(d, "MMMM yyyy", { locale: es });
        options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
    }
    return options;
}

export function ForecastTableView() {
    const { user } = useAuth();
    const now = new Date();
    const [startMonth, setStartMonth] = useState(format(now, 'yyyy-MM'));
    const [endMonth, setEndMonth] = useState(format(addMonths(now, 5), 'yyyy-MM'));
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
    const [assignModal, setAssignModal] = useState<{
        itemName: string;
        currentCategory: string;
        source: 'transaction' | 'fixed_expense' | 'credit_purchase';
        identifier: string;
    } | null>(null);

    const monthOptions = useMemo(generateMonthOptions, []);

    const { data, isLoading } = useForecastTable({
        userId: user?.id,
        startMonth,
        endMonth,
    });

    const toggleGroup = (groupName: string) => {
        setCollapsedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(groupName)) next.delete(groupName);
            else next.add(groupName);
            return next;
        });
    };

    const handleRowClick = (row: ForecastRow, group: CategoryGroup) => {
        // Allow editing category for any row
        setAssignModal({
            itemName: row.name,
            currentCategory: row.categoryName || row.name, // Use group/category name
            source: row.source,
            identifier: row.originalId,
        });
    };

    if (isLoading || !data) {
        return (
            <div className="space-y-4 p-2">
                <div className="h-10 bg-surface/50 rounded-lg w-64 animate-pulse" />
                <div className="bg-surface rounded-xl p-6 animate-pulse h-[450px]" />
            </div>
        );
    }

    const { months, groups, monthlyTotals, monthlyIncome } = data;

    return (
        <div className="space-y-5">
            {/* Header + Date Range Selector */}
            <div className="flex items-end justify-between flex-wrap gap-4">
                <h2 className="text-lg font-bold text-text-main">Proyección de Gastos Recurrentes</h2>
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-2 bg-surface border border-border rounded-xl px-3 py-2 shadow-sm">
                        <Calendar className="w-4 h-4 text-text-muted shrink-0" />
                        <select
                            value={startMonth}
                            onChange={(e) => {
                                setStartMonth(e.target.value);
                                if (e.target.value > endMonth) setEndMonth(e.target.value);
                            }}
                            className="bg-transparent text-sm font-medium text-text-main focus:outline-none cursor-pointer appearance-none pr-2"
                        >
                            {monthOptions.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                    </div>
                    <span className="text-text-muted text-sm font-medium">→</span>
                    <div className="flex items-center gap-2 bg-surface border border-border rounded-xl px-3 py-2 shadow-sm">
                        <Calendar className="w-4 h-4 text-text-muted shrink-0" />
                        <select
                            value={endMonth}
                            onChange={(e) => {
                                setEndMonth(e.target.value);
                                if (e.target.value < startMonth) setStartMonth(e.target.value);
                            }}
                            className="bg-transparent text-sm font-medium text-text-main focus:outline-none cursor-pointer appearance-none pr-2"
                        >
                            {monthOptions.filter(o => o.value >= startMonth).map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-3">
                {groups.map((group) => {
                    const isCollapsed = collapsedGroups.has(group.name);
                    const CollapseIcon = isCollapsed ? ChevronRight : ChevronDown;
                    const groupTotal = months.reduce((sum, m) =>
                        sum + group.rows.reduce((s, r) => s + (r.amounts[m.key] || 0), 0), 0
                    );

                    return (
                        <div key={group.name} className="bg-surface border border-border rounded-xl overflow-hidden">
                            <button
                                onClick={() => toggleGroup(group.name)}
                                className="w-full flex items-center justify-between px-4 py-3 active:bg-background transition"
                            >
                                <div className="flex items-center gap-2">
                                    <CollapseIcon className="w-4 h-4 text-text-muted" />
                                    <span
                                        className="text-xs font-extrabold uppercase tracking-wider"
                                        style={{ color: group.color }}
                                    >
                                        {group.name}
                                    </span>
                                    <span className="text-[10px] text-text-muted">({group.rows.length})</span>
                                </div>
                                <span className="text-sm font-bold text-text-main tabular-nums">
                                    {formatCurrency(groupTotal / months.length)}/mes
                                </span>
                            </button>

                            {!isCollapsed && (
                                <div className="border-t border-border divide-y divide-border/50">
                                    {group.rows.map((row) => {
                                        const Icon = getIconForCategory(row.name);
                                        return (
                                            <div
                                                key={row.id}
                                                className="px-4 py-3 active:bg-background/50 cursor-pointer"
                                                onClick={() => handleRowClick(row, group)}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <div
                                                            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                                                            style={{ backgroundColor: group.color + '18' }}
                                                        >
                                                            <Icon className="w-3.5 h-3.5" style={{ color: group.color }} />
                                                        </div>
                                                        <span className="text-sm text-text-main font-medium truncate">{row.name}</span>
                                                    </div>
                                                    <Pencil className="w-3 h-3 text-text-muted shrink-0 ml-2" />
                                                </div>
                                                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                                                    {months.map((m) => {
                                                        const amount = row.amounts[m.key];
                                                        return (
                                                            <div
                                                                key={m.key}
                                                                className={`flex flex-col items-center px-2 py-1.5 rounded-lg min-w-[4rem] shrink-0 ${m.isCurrent ? 'bg-primary/10' : 'bg-background/50'
                                                                    }`}
                                                            >
                                                                <span className={`text-[9px] font-bold uppercase ${m.isCurrent ? 'text-primary' : 'text-text-muted'}`}>
                                                                    {m.label.slice(0, 3)}
                                                                </span>
                                                                <span className="text-xs font-medium text-text-main tabular-nums mt-0.5">
                                                                    {amount !== undefined ? formatCurrency(amount) : '—'}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Mobile Totals */}
                <div className="grid grid-cols-1 gap-3">
                    {Object.values(monthlyIncome).some((v) => v > 0) && (
                        <div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <TrendingUp className="w-5 h-5 text-primary" />
                                <span className="text-sm font-bold text-primary">Total Ingresos</span>
                            </div>
                            <div className="flex gap-2 overflow-x-auto pb-1">
                                {months.map((m) => (
                                    <div key={m.key} className={`flex flex-col items-center px-2 py-1.5 rounded-lg min-w-[4rem] shrink-0 ${m.isCurrent ? 'bg-primary/20' : 'bg-primary/5'}`}>
                                        <span className={`text-[9px] font-bold uppercase ${m.isCurrent ? 'text-primary' : 'text-text-muted'}`}>{m.label.slice(0, 3)}</span>
                                        <span className="text-xs font-bold text-primary tabular-nums mt-0.5">{formatCurrency(monthlyIncome[m.key] || 0)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <TrendingDown className="w-5 h-5 text-red-500" />
                            <span className="text-sm font-bold text-red-500">Total Gastos</span>
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                            {months.map((m) => (
                                <div key={m.key} className={`flex flex-col items-center px-2 py-1.5 rounded-lg min-w-[4rem] shrink-0 ${m.isCurrent ? 'bg-red-500/20' : 'bg-red-500/5'}`}>
                                    <span className={`text-[9px] font-bold uppercase ${m.isCurrent ? 'text-red-500' : 'text-text-muted'}`}>{m.label.slice(0, 3)}</span>
                                    <span className="text-xs font-bold text-red-500 tabular-nums mt-0.5">{formatCurrency(monthlyTotals[m.key] || 0)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-primary/15 border border-primary/30 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <DollarSign className="w-5 h-5 text-primary" />
                            <span className="text-sm font-extrabold text-primary">Balance Neto</span>
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                            {months.map((m) => {
                                const net = (monthlyIncome[m.key] || 0) - (monthlyTotals[m.key] || 0);
                                return (
                                    <div key={m.key} className={`flex flex-col items-center px-2 py-1.5 rounded-lg min-w-[4rem] shrink-0 ${m.isCurrent ? 'bg-primary/25' : 'bg-primary/5'}`}>
                                        <span className={`text-[9px] font-bold uppercase ${m.isCurrent ? 'text-primary' : 'text-text-muted'}`}>{m.label.slice(0, 3)}</span>
                                        <span className={`text-xs font-extrabold tabular-nums mt-0.5 ${net >= 0 ? 'text-primary' : 'text-red-500'}`}>{formatCurrency(net)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px] border-collapse">
                        <thead>
                            <tr className="border-b border-border">
                                <th className="sticky left-0 z-10 bg-surface text-left px-5 py-4 min-w-[280px] text-xs font-bold uppercase tracking-wider text-text-muted border-r border-border/50 shadow-[4px_0_24px_-2px_rgba(0,0,0,0.1)] clip-path-[inset(0_-24px_0_0)]">
                                    Categoría de Gasto
                                </th>
                                {months.map((m) => (
                                    <th
                                        key={m.key}
                                        className={`px-4 py-4 text-right min-w-[130px] ${m.isCurrent ? 'bg-primary/5' : ''}`}
                                    >
                                        <span className={`text-xs font-bold uppercase tracking-wider ${m.isCurrent ? 'text-primary' : 'text-text-muted'}`}>
                                            {m.label}
                                        </span>
                                        <br />
                                        <span className="text-[10px] text-text-muted/60">{m.year}</span>
                                    </th>
                                ))}
                            </tr>
                        </thead>

                        <tbody>
                            {groups.map((group) => {
                                const isCollapsed = collapsedGroups.has(group.name);
                                const CollapseIcon = isCollapsed ? ChevronRight : ChevronDown;

                                return (
                                    <GroupSection
                                        key={group.name}
                                        group={group}
                                        months={months}
                                        isCollapsed={isCollapsed}
                                        CollapseIcon={CollapseIcon}
                                        onToggle={() => toggleGroup(group.name)}
                                        onRowClick={(row) => handleRowClick(row, group)}
                                    />
                                );
                            })}

                            {/* Income totals row */}
                            {Object.values(monthlyIncome).some((v) => v > 0) && (
                                <tr className="border-t-2 border-primary/30">
                                    <td className="sticky left-0 z-10 bg-primary/10 px-5 py-4 whitespace-nowrap border-r border-primary/10 shadow-[4px_0_24px_-2px_rgba(0,0,0,0.05)]">
                                        <div className="flex items-center gap-2">
                                            <TrendingUp className="w-5 h-5 text-primary shrink-0" />
                                            <span className="text-sm font-bold text-primary">
                                                Total Ingresos
                                            </span>
                                        </div>
                                    </td>
                                    {months.map((m) => (
                                        <td
                                            key={m.key}
                                            className={`px-4 py-4 text-right bg-primary/10 ${m.isCurrent ? 'bg-primary/15' : ''}`}
                                        >
                                            <span className="text-sm font-bold text-primary tabular-nums">
                                                {formatCurrency(monthlyIncome[m.key] || 0)}
                                            </span>
                                        </td>
                                    ))}
                                </tr>
                            )}

                            {/* Expense totals row */}
                            <tr className="border-t-2 border-red-500/30">
                                <td className="sticky left-0 z-10 bg-red-500/10 px-5 py-4 whitespace-nowrap border-r border-red-500/10 shadow-[4px_0_24px_-2px_rgba(0,0,0,0.05)]">
                                    <div className="flex items-center gap-2">
                                        <TrendingDown className="w-5 h-5 text-red-500 shrink-0" />
                                        <span className="text-sm font-bold text-red-500">
                                            Total Gastos &amp; Obligaciones
                                        </span>
                                    </div>
                                </td>
                                {months.map((m) => (
                                    <td
                                        key={m.key}
                                        className={`px-4 py-4 text-right bg-red-500/10 ${m.isCurrent ? 'bg-red-500/15' : ''}`}
                                    >
                                        <span className="text-sm font-bold text-red-500 tabular-nums">
                                            {formatCurrency(monthlyTotals[m.key] || 0)}
                                        </span>
                                    </td>
                                ))}
                            </tr>

                            {/* Net balance row */}
                            <tr className="border-t-2 border-primary/40">
                                <td className="sticky left-0 z-10 bg-primary/15 px-5 py-4 rounded-bl-2xl whitespace-nowrap border-r border-primary/10 shadow-[4px_0_24px_-2px_rgba(0,0,0,0.05)]">
                                    <div className="flex items-center gap-2">
                                        <DollarSign className="w-5 h-5 text-primary shrink-0" />
                                        <span className="text-sm font-extrabold text-primary">
                                            Balance Neto
                                        </span>
                                    </div>
                                </td>
                                {months.map((m, i) => {
                                    const net = (monthlyIncome[m.key] || 0) - (monthlyTotals[m.key] || 0);
                                    const isLast = i === months.length - 1;
                                    return (
                                        <td
                                            key={m.key}
                                            className={`px-4 py-4 text-right bg-primary/15 ${m.isCurrent ? 'bg-primary/20' : ''} ${isLast ? 'rounded-br-2xl' : ''}`}
                                        >
                                            <span className={`text-sm font-extrabold tabular-nums ${net >= 0 ? 'text-primary' : 'text-red-500'}`}>
                                                {formatCurrency(net)}
                                            </span>
                                        </td>
                                    );
                                })}
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-xs text-text-muted px-1">
                <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" />
                    Mes actual
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-text-muted/30 inline-block" />
                    Proyección futura
                </span>
                <span className="flex items-center gap-1.5">
                    <Pencil className="w-3 h-3 text-text-muted" />
                    Clic para editar/asignar categoría
                </span>
            </div>

            {/* Category assignment modal */}
            {assignModal && (
                <CategoryAssignModal
                    itemName={assignModal.itemName}
                    currentCategory={assignModal.currentCategory}
                    source={assignModal.source}
                    identifier={assignModal.identifier}
                    onClose={() => setAssignModal(null)}
                    onSuccess={() => setAssignModal(null)}
                />
            )}
        </div>
    );
}

interface GroupSectionProps {
    group: CategoryGroup;
    months: MonthColumn[];
    isCollapsed: boolean;
    CollapseIcon: React.ElementType;
    onToggle: () => void;
    onRowClick: (row: ForecastRow) => void;
}

function GroupSection({ group, months, isCollapsed, CollapseIcon, onToggle, onRowClick }: GroupSectionProps) {
    const groupMonthTotals: Record<string, number> = {};
    months.forEach((m) => {
        groupMonthTotals[m.key] = group.rows.reduce((sum, row) => sum + (row.amounts[m.key] || 0), 0);
    });

    const showClickHint = !group.hasProperCategory;

    return (
        <>
            <tr
                className="cursor-pointer select-none group/header hover:bg-background/50 transition-colors"
                onClick={onToggle}
            >
                <td className="sticky left-0 z-10 bg-surface group-hover/header:bg-background/50 transition-colors px-5 py-3 border-t border-border border-r border-border/50 shadow-[4px_0_24px_-2px_rgba(0,0,0,0.1)]">
                    <div className="flex items-center gap-2">
                        <CollapseIcon className="w-4 h-4 text-text-muted transition-transform shrink-0" />
                        <span
                            className="text-xs font-extrabold uppercase tracking-widest"
                            style={{ color: group.color }}
                        >
                            {group.name}
                        </span>
                        <span className="text-[10px] text-text-muted ml-1">
                            ({group.rows.length})
                        </span>
                        {showClickHint && (
                            <Pencil className="w-3 h-3 text-amber-500 ml-auto shrink-0 opacity-60" />
                        )}
                    </div>
                </td>
                {months.map((m) => (
                    <td
                        key={m.key}
                        className={`px-4 py-3 text-right border-t border-border ${m.isCurrent ? 'bg-primary/5' : ''}`}
                    >
                        {isCollapsed && (
                            <span className="text-xs font-semibold text-text-muted tabular-nums">
                                {formatCurrency(groupMonthTotals[m.key])}
                            </span>
                        )}
                    </td>
                ))}
            </tr>

            {!isCollapsed &&
                group.rows.map((row) => {
                    const Icon = getIconForCategory(row.name);
                    const needsAttention = !group.hasProperCategory;
                    const isClickable = true; // Always clickable now

                    return (
                        <tr
                            key={row.id}
                            className={`transition-colors cursor-pointer ${needsAttention ? 'hover:bg-amber-500/5' : 'hover:bg-background/30'
                                }`}
                            onClick={() => onRowClick(row)}
                        >
                            <td className={`sticky left-0 z-10 transition-colors px-5 py-3 pl-10 border-r border-border/50 shadow-[4px_0_24px_-2px_rgba(0,0,0,0.1)] ${needsAttention ? 'bg-surface hover:bg-amber-500/5' : 'bg-surface hover:bg-background/30'}`}>
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                                        style={{ backgroundColor: group.color + '18' }}
                                    >
                                        <Icon className="w-3.5 h-3.5" style={{ color: group.color }} />
                                    </div>
                                    <span className="text-sm text-text-main truncate">{row.name}</span>
                                    {row.accountName && (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary/10 text-[10px] font-medium text-primary shrink-0 max-w-[120px] truncate" title={row.accountName}>
                                            <CreditCard className="w-2.5 h-2.5 shrink-0" />
                                            {row.accountName}
                                        </span>
                                    )}
                                    {isClickable && (
                                        <Pencil className={`w-3 h-3 ml-auto shrink-0 transition-opacity ${needsAttention ? 'text-amber-500 opacity-60' : 'text-text-muted opacity-0 group-hover:opacity-60'
                                            }`} />
                                    )}
                                </div>
                            </td>
                            {months.map((m) => {
                                const amount = row.amounts[m.key];
                                return (
                                    <td
                                        key={m.key}
                                        className={`px-4 py-3 text-right ${m.isCurrent ? 'bg-primary/5' : ''}`}
                                    >
                                        {amount !== undefined ? (
                                            <span className="text-sm text-text-main font-medium tabular-nums">
                                                {formatCurrency(amount)}
                                            </span>
                                        ) : (
                                            <span className="text-sm text-text-muted/40">—</span>
                                        )}
                                    </td>
                                );
                            })}
                        </tr>
                    );
                })}
        </>
    );
}
