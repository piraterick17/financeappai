import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Plus, Calendar, PieChart, ArrowRightLeft, TableProperties } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isAfter, isBefore, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { AddIncomeModal } from './AddIncomeModal';
import { SchedulePaymentModal } from './SchedulePaymentModal';
import { BudgetLimitModal } from './BudgetLimitModal';
import { BudgetCard } from './BudgetCard';
import { ForecastTableView } from './ForecastTableView';
import { FilterDropdown } from '../Transactions/FilterDropdown';
import { Database } from '../../lib/database.types';
import { toast } from 'sonner';

type Account = Database['public']['Tables']['accounts']['Row'];

interface DayTransaction {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category?: string;
  is_transfer?: boolean;
  is_projected?: boolean;
}

interface DayForecast {
  date: Date;
  income: DayTransaction[];
  expenses: DayTransaction[];
  transfers: DayTransaction[];
  totalIncome: number;
  totalExpenses: number;
}

type FilterType = 'all' | 'income' | 'payments';
type ViewMode = 'calendar' | 'budgets' | 'projection';

interface BudgetStatus {
  category_id: string;
  category_name: string;
  limit_amount: number;
  spent_amount: number;
  percentage: number;
  category_color?: string;
}

export function ForecastView() {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());
  const [forecast, setForecast] = useState<Map<string, DayForecast>>(new Map());

  const [monthlyStartBalance, setMonthlyStartBalance] = useState(0);
  const [endOfMonthBalance, setEndOfMonthBalance] = useState(0);
  const [monthTotalIncome, setMonthTotalIncome] = useState(0);
  const [monthTotalExpenses, setMonthTotalExpenses] = useState(0);

  const [loading, setLoading] = useState(true);
  const [showAddIncomeModal, setShowAddIncomeModal] = useState(false);
  const [showSchedulePaymentModal, setShowSchedulePaymentModal] = useState(false);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<{ category_id: string; amount: number } | undefined>();
  const [budgetStatuses, setBudgetStatuses] = useState<BudgetStatus[]>([]);
  const [loadingBudgets, setLoadingBudgets] = useState(false);

  useEffect(() => {
    if (user) {
      loadForecast();
      if (viewMode === 'budgets') loadBudgetStatus();
    }
  }, [user, currentMonth, selectedAccounts, viewMode]);

  const loadForecast = async () => {
    if (!user) return;
    setLoading(true);

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    await supabase.rpc('generate_fixed_expense_projections', { p_user_id: user.id });

    const [accountsRes, transactionsRes] = await Promise.all([
      supabase.from('accounts').select('*').eq('user_id', user.id).eq('is_active', true),
      supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .gte('transaction_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('transaction_date', format(monthEnd, 'yyyy-MM-dd')),
    ]);

    if (accountsRes.data) setAccounts(accountsRes.data);

    const filteredAccounts = accountsRes.data
      ?.filter(acc => selectedAccounts.length === 0 || selectedAccounts.includes(acc.id)) || [];

    const nowBalance = filteredAccounts.reduce((sum, acc) => {
      return sum + Number(acc.balance);
    }, 0);

    const forecastMap = new Map<string, DayForecast>();
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    days.forEach(day => {
      forecastMap.set(format(day, 'yyyy-MM-dd'), {
        date: day,
        income: [],
        expenses: [],
        transfers: [],
        totalIncome: 0,
        totalExpenses: 0,
      });
    });

    let calculatedIncome = 0;
    let calculatedExpenses = 0;
    let pastFlow = 0;
    let futureFlow = 0;
    const today = startOfDay(new Date());

    if (transactionsRes.data) {
      transactionsRes.data
        .filter(t => selectedAccounts.length === 0 || selectedAccounts.includes(t.account_id))
        .forEach(t => {
          const dayKey = t.transaction_date;
          let dayData = forecastMap.get(dayKey);

          if (!dayData) {
            dayData = {
              date: new Date(t.transaction_date + 'T00:00:00'),
              income: [],
              expenses: [],
              transfers: [],
              totalIncome: 0,
              totalExpenses: 0,
            };
            forecastMap.set(dayKey, dayData);
          }

          const amount = Math.abs(Number(t.amount));
          const item: DayTransaction = {
            id: t.id,
            description: t.description,
            amount: amount,
            type: t.type,
            category: t.category || undefined,
            is_transfer: t.is_transfer,
            is_projected: t.is_projected
          };

          const tDate = new Date(t.transaction_date + 'T12:00:00');

          if (t.is_transfer) {
            dayData.transfers.push(item);
          } else {
            if (t.type === 'income') {
              dayData.income.push(item);
              dayData.totalIncome += amount;
              calculatedIncome += amount;

              if (!t.is_projected && isBefore(tDate, today)) pastFlow += amount;
              if (t.is_projected || !isBefore(tDate, today)) futureFlow += amount;
            } else {
              dayData.expenses.push(item);
              dayData.totalExpenses += amount;
              calculatedExpenses += amount;

              if (!t.is_projected && isBefore(tDate, today)) pastFlow -= amount;
              if (t.is_projected || !isBefore(tDate, today)) futureFlow -= amount;
            }
          }
        });
    }

    setForecast(forecastMap);
    setMonthTotalIncome(calculatedIncome);
    setMonthTotalExpenses(calculatedExpenses);

    if (isSameDay(monthStart, startOfMonth(today))) {
      setMonthlyStartBalance(nowBalance - pastFlow);
      setEndOfMonthBalance(nowBalance + futureFlow);
    } else if (isAfter(monthStart, today)) {
      setMonthlyStartBalance(nowBalance);
      setEndOfMonthBalance(nowBalance + calculatedIncome - calculatedExpenses);
    } else {
      setMonthlyStartBalance(0);
      setEndOfMonthBalance(calculatedIncome - calculatedExpenses);
    }

    setLoading(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getUpcomingPayments = () => {
    const today = startOfDay(new Date());
    const upcoming: Array<{ date: Date; description: string; amount: number }> = [];

    forecast.forEach((day) => {
      if ((isSameDay(day.date, today) || isAfter(day.date, today)) && day.expenses.length > 0) {
        day.expenses.forEach(expense => {
          if (!expense.is_transfer) {
            upcoming.push({
              date: day.date,
              description: expense.description,
              amount: expense.amount
            });
          }
        });
      }
    });

    return upcoming.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 5);
  };

  const loadBudgetStatus = async () => {
    if (!user) return;
    setLoadingBudgets(true);
    try {
      const monthDate = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const { data, error } = await supabase.rpc('get_monthly_budget_status', { p_month: monthDate });
      if (error) throw error;

      const budgetsWithColors = await Promise.all((data || []).map(async (budget: any) => {
        const { data: cat } = await supabase.from('categories').select('color').eq('id', budget.category_id).single();
        return { ...budget, category_color: cat?.color || '#6B7280' };
      }));
      setBudgetStatuses(budgetsWithColors);
    } catch (err) {
      console.error(err);
      toast.error('Error al cargar presupuestos');
    } finally {
      setLoadingBudgets(false);
    }
  };

  const handleEditBudget = (id: string, amount: number) => {
    setEditingBudget({ category_id: id, amount });
    setShowBudgetModal(true);
  };

  const handleDeleteBudget = async (id: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('category_budgets')
        .delete()
        .eq('category_id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      toast.success('Presupuesto eliminado');
      loadBudgetStatus();
    } catch (err) {
      console.error(err);
      toast.error('Error al eliminar presupuesto');
    }
  };

  const getFilteredCalendarIndicators = (hasIncome: boolean, hasExpenses: boolean) => {
    if (filterType === 'income') return hasIncome;
    if (filterType === 'payments') return hasExpenses;
    return hasIncome || hasExpenses;
  };

  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const weekDays = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

    // Days with activity for mobile schedule view
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    return (
      <div className="space-y-2">
        {/* Mobile Schedule List View */}
        <div className="lg:hidden space-y-2">
          {daysInMonth.map(day => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const dayData = forecast.get(dayKey);
            const isToday = isSameDay(day, new Date());
            const isSelected = selectedDay && isSameDay(day, selectedDay);
            const hasActivity = dayData && (dayData.totalIncome > 0 || dayData.totalExpenses > 0 || dayData.transfers.length > 0);
            const shouldShowIndicators = dayData && getFilteredCalendarIndicators(dayData.totalIncome > 0, dayData.totalExpenses > 0);

            if (!hasActivity && !isToday) return null;

            return (
              <button
                key={dayKey}
                onClick={() => setSelectedDay(day)}
                className={`w-full flex items-start gap-3 p-3 rounded-xl border transition-all text-left active:scale-[0.98] ${isSelected
                  ? 'border-primary bg-primary/10 shadow-sm'
                  : isToday
                    ? 'border-primary/30 bg-primary/5'
                    : 'border-border bg-surface hover:border-primary/30'
                  }`}
              >
                <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 ${isToday ? 'bg-primary text-primary-fg' : 'bg-background'}`}>
                  <span className="text-lg font-bold leading-none">{format(day, 'd')}</span>
                  <span className="text-[9px] font-bold uppercase">{format(day, 'EEE', { locale: es })}</span>
                </div>
                <div className="flex-1 min-w-0">
                  {dayData && shouldShowIndicators && (
                    <div className="space-y-1">
                      {(filterType === 'all' || filterType === 'income') && dayData.income.map(t => (
                        <div key={t.id} className="flex items-center justify-between">
                          <span className="text-sm text-text-main truncate">{t.description}</span>
                          <span className="text-sm font-semibold text-primary ml-2 shrink-0">+{formatCurrency(t.amount)}</span>
                        </div>
                      ))}
                      {dayData.transfers.map(t => (
                        <div key={t.id} className="flex items-center justify-between">
                          <span className="text-sm text-text-muted truncate">{t.description}</span>
                          <span className="text-sm font-medium text-blue-400 ml-2 shrink-0">{formatCurrency(t.amount)}</span>
                        </div>
                      ))}
                      {(filterType === 'all' || filterType === 'payments') && dayData.expenses.map(t => (
                        <div key={t.id} className="flex items-center justify-between">
                          <span className="text-sm text-text-main truncate">{t.description}</span>
                          <span className="text-sm font-semibold text-red-500 ml-2 shrink-0">-{formatCurrency(t.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {(!hasActivity && isToday) && (
                    <p className="text-xs text-text-muted italic">Hoy — sin movimientos</p>
                  )}
                </div>
              </button>
            );
          })}
          {daysInMonth.every(day => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const dayData = forecast.get(dayKey);
            return !(dayData && (dayData.totalIncome > 0 || dayData.totalExpenses > 0 || dayData.transfers.length > 0)) && !isSameDay(day, new Date());
          }) && (
              <div className="text-center py-8 text-text-muted text-sm">
                No hay movimientos programados para este mes
              </div>
            )}
        </div>

        {/* Desktop Calendar Grid */}
        <div className="hidden lg:block">
          <div className="grid grid-cols-7 gap-1">
            {weekDays.map(day => (
              <div key={day} className="h-12 flex items-center justify-center">
                <p className="text-xs font-bold uppercase tracking-wider text-text-muted">{day}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map(day => {
              const dayKey = format(day, 'yyyy-MM-dd');
              const dayData = forecast.get(dayKey);
              const isCurrentMonth = day >= monthStart && day <= monthEnd;
              const isToday = isSameDay(day, new Date());
              const isSelected = selectedDay && isSameDay(day, selectedDay);

              const hasIncome = dayData && dayData.totalIncome > 0;
              const hasExpenses = dayData && dayData.totalExpenses > 0;
              const shouldShowIndicators = getFilteredCalendarIndicators(hasIncome, hasExpenses);

              return (
                <button
                  key={dayKey}
                  onClick={() => isCurrentMonth && setSelectedDay(day)}
                  disabled={!isCurrentMonth}
                  className={`h-28 rounded-lg border transition-all relative overflow-hidden ${isSelected ? 'border-2 border-primary bg-primary/10' :
                    isToday ? 'border border-primary/30 bg-primary/5' :
                      'border border-border bg-surface hover:border-primary/50'
                    } ${!isCurrentMonth ? 'opacity-30' : ''}`}
                >
                  <div className="flex flex-col h-full p-2">
                    <span className={`text-sm font-medium ${isSelected || isToday ? 'text-text-main' : 'text-text-muted'}`}>
                      {format(day, 'd')}
                    </span>
                    {isCurrentMonth && shouldShowIndicators && (
                      <div className="mt-auto flex flex-col gap-1">
                        {(filterType === 'all' || filterType === 'income') && hasIncome && (
                          <div className="h-1.5 w-full rounded-full bg-primary/80"></div>
                        )}
                        {(filterType === 'all' || filterType === 'payments') && hasExpenses && (
                          <div className="h-1.5 w-full rounded-full bg-red-500/80"></div>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const selectedDayData = selectedDay ? forecast.get(format(selectedDay, 'yyyy-MM-dd')) : null;
  const upcomingPayments = getUpcomingPayments();

  if (loading) {
    return (
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="h-8 bg-surface/50 rounded w-48 animate-pulse"></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-surface rounded-xl p-6 animate-pulse h-96"></div>
          <div className="space-y-4">
            <div className="bg-surface rounded-xl p-6 animate-pulse h-48"></div>
            <div className="bg-surface rounded-xl p-6 animate-pulse h-64"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <header>
        <div className="flex items-center gap-2 border-b border-border">
          <button
            onClick={() => setViewMode('calendar')}
            className={`flex items-center gap-2 px-4 py-3 font-semibold transition relative ${viewMode === 'calendar' ? 'text-primary' : 'text-text-muted'
              }`}
          >
            <Calendar className="w-4 h-4" />
            Calendario
            {viewMode === 'calendar' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
          </button>
          <button
            onClick={() => setViewMode('budgets')}
            className={`flex items-center gap-2 px-4 py-3 font-semibold transition relative ${viewMode === 'budgets' ? 'text-primary' : 'text-text-muted'
              }`}
          >
            <PieChart className="w-4 h-4" />
            Presupuestos
            {viewMode === 'budgets' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
          </button>
          <button
            onClick={() => setViewMode('projection')}
            className={`flex items-center gap-2 px-4 py-3 font-semibold transition relative ${viewMode === 'projection' ? 'text-primary' : 'text-text-muted'
              }`}
          >
            <TableProperties className="w-4 h-4" />
            Proyección
            {viewMode === 'projection' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
          </button>
        </div>

        {viewMode === 'calendar' && (
          <div className="flex flex-wrap items-center gap-3 mt-6">
            <FilterDropdown
              label="Cuentas"
              options={accounts.map(a => ({ value: a.id, label: a.name }))}
              selectedValues={selectedAccounts}
              onChange={setSelectedAccounts}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setFilterType('all')}
                className={`px-4 py-2 rounded-lg font-medium transition ${filterType === 'all'
                  ? 'bg-primary text-primary-fg'
                  : 'bg-surface text-text-muted hover:bg-background'
                  }`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterType('income')}
                className={`px-4 py-2 rounded-lg font-medium transition ${filterType === 'income'
                  ? 'bg-primary text-primary-fg'
                  : 'bg-surface text-text-muted hover:bg-background'
                  }`}
              >
                Ingresos
              </button>
              <button
                onClick={() => setFilterType('payments')}
                className={`px-4 py-2 rounded-lg font-medium transition ${filterType === 'payments'
                  ? 'bg-primary text-primary-fg'
                  : 'bg-surface text-text-muted hover:bg-background'
                  }`}
              >
                Pagos
              </button>
            </div>
          </div>
        )}
      </header>

      {viewMode === 'projection' ? (
        <ForecastTableView />
      ) : viewMode === 'budgets' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loadingBudgets ? (
            <div className="col-span-full text-center text-text-muted">Cargando presupuestos...</div>
          ) : budgetStatuses.length === 0 ? (
            <div className="col-span-full text-center py-8">
              <PieChart className="w-12 h-12 text-text-muted/40 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-text-main mb-2">Sin presupuestos definidos</h3>
              <p className="text-text-muted text-sm mb-6 max-w-sm mx-auto">Crea presupuestos por categoría para controlar tus gastos mensuales y recibir alertas.</p>
              <button
                onClick={() => setShowBudgetModal(true)}
                className="px-6 py-3 bg-primary text-primary-fg rounded-lg font-semibold hover:opacity-90 transition"
              >
                <Plus className="w-4 h-4 inline mr-2" />
                Crear Presupuesto
              </button>
            </div>
          ) : (
            budgetStatuses.map(b => (
              <BudgetCard
                key={b.category_id}
                categoryId={b.category_id}
                categoryName={b.category_name}
                categoryColor={b.category_color}
                spent={b.spent_amount}
                limit={b.limit_amount}
                percentageUsed={b.percentage}
                onEdit={handleEditBudget}
                onDelete={handleDeleteBudget}
              />
            ))
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-surface border border-border rounded-xl p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  className="p-2 rounded-full hover:bg-background text-text-main transition"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-lg font-bold text-text-main capitalize">
                  {format(currentMonth, 'MMMM yyyy', { locale: es })}
                </h2>
                <button
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  className="p-2 rounded-full hover:bg-background text-text-main transition"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              {renderCalendar()}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-surface border border-primary/20 rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-text-main mb-4">
                Resumen {format(currentMonth, 'MMMM', { locale: es })}
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Saldo Inicial (Est.)</span>
                  <span className="text-text-main font-medium">{formatCurrency(monthlyStartBalance)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-primary flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" />
                    Ingresos Reales
                  </span>
                  <span className="text-primary font-semibold">+{formatCurrency(monthTotalIncome)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-red-500 flex items-center gap-1">
                    <TrendingDown className="w-4 h-4" />
                    Gastos Reales
                  </span>
                  <span className="text-red-500 font-semibold">-{formatCurrency(monthTotalExpenses)}</span>
                </div>
                <div className="border-t border-dashed border-border my-2"></div>
                <div className="flex justify-between font-bold">
                  <span className="text-text-main">Saldo Final (Est.)</span>
                  <span className={endOfMonthBalance >= 0 ? 'text-primary' : 'text-red-500'}>
                    {formatCurrency(endOfMonthBalance)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-surface border border-primary/20 rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-text-main mb-4">
                {selectedDay ? format(selectedDay, 'd MMMM', { locale: es }) : 'Detalles'}
              </h3>
              {selectedDayData ? (
                <div className="space-y-4">
                  {selectedDayData.transfers.length > 0 && (
                    <div className="p-3 bg-background/50 rounded-lg border border-border">
                      <h4 className="text-xs font-bold text-blue-400 mb-2 flex items-center gap-1">
                        <ArrowRightLeft className="w-3 h-3" />
                        Transferencias (Neutro)
                      </h4>
                      {selectedDayData.transfers.map(t => (
                        <div key={t.id} className="flex justify-between text-sm mb-1">
                          <span className="text-text-muted truncate w-2/3">{t.description}</span>
                          <span className="text-text-main font-medium">{formatCurrency(t.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedDayData.income.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-primary mb-2">Ingresos</h4>
                      {selectedDayData.income.map(t => (
                        <div key={t.id} className="flex justify-between text-sm mb-1">
                          <span className="text-text-muted">{t.description}</span>
                          <span className="text-primary">+{formatCurrency(t.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedDayData.expenses.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-red-500 mb-2">Gastos</h4>
                      {selectedDayData.expenses.map(t => (
                        <div key={t.id} className="flex justify-between text-sm mb-1">
                          <span className="text-text-muted">{t.description}</span>
                          <span className="text-red-500">-{formatCurrency(t.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedDayData.income.length === 0 && selectedDayData.expenses.length === 0 && selectedDayData.transfers.length === 0 && (
                    <p className="text-text-muted text-center text-sm">Sin movimientos</p>
                  )}
                </div>
              ) : (
                <p className="text-text-muted text-center">Selecciona un día</p>
              )}
            </div>

            <div className="bg-surface border border-primary/20 rounded-xl p-6">
              <h3 className="text-lg font-bold text-text-main">Próximos Pagos</h3>
              {upcomingPayments.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {upcomingPayments.map((payment, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-text-main">{payment.description}</p>
                        <p className="text-xs text-text-muted mt-0.5">
                          Vence {format(payment.date, 'd MMM', { locale: es })}
                        </p>
                      </div>
                      <p className="text-sm font-medium text-red-500 ml-4">-{formatCurrency(payment.amount)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-6 py-8 text-center">
                  <p className="text-sm text-text-muted">No hay pagos próximos programados</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <button
                onClick={() => setShowSchedulePaymentModal(true)}
                className="w-full py-3 bg-primary text-primary-fg rounded-xl font-bold hover:opacity-90 transition shadow-lg"
              >
                <Plus className="w-5 h-5 inline mr-2" />
                Programar Pago Futuro
              </button>
              <button
                onClick={() => setShowAddIncomeModal(true)}
                className="w-full py-3 bg-primary/20 text-primary rounded-xl font-bold hover:bg-primary/30 transition"
              >
                <Plus className="w-5 h-5 inline mr-2" />
                Agregar Ingreso
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddIncomeModal && (
        <AddIncomeModal
          onClose={() => setShowAddIncomeModal(false)}
          onSuccess={() => {
            setShowAddIncomeModal(false);
            loadForecast();
          }}
        />
      )}

      {showSchedulePaymentModal && (
        <SchedulePaymentModal
          onClose={() => setShowSchedulePaymentModal(false)}
          onSuccess={() => {
            setShowSchedulePaymentModal(false);
            loadForecast();
          }}
        />
      )}

      {showBudgetModal && (
        <BudgetLimitModal
          onClose={() => {
            setShowBudgetModal(false);
            setEditingBudget(undefined);
          }}
          onSuccess={() => {
            loadBudgetStatus();
          }}
          existingBudget={editingBudget}
        />
      )}
    </div>
  );
}
