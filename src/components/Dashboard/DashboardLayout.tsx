import { ReactNode, useState } from 'react';
import { NavLink, useLocation, Outlet } from 'react-router-dom';
import { Wallet, LayoutDashboard, CreditCard, TrendingUp, BarChart3, Settings, LogOut, Menu, X, Moon, Sun, CalendarRange, PlusCircle } from 'lucide-react';

// ...


import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { QuickAddButton } from '../Transactions/QuickAddButton';
import { AddMovementModal } from '../Transactions/AddMovementModal';
import { AICopilotPanel } from '../AICopilot/AICopilotPanel';

interface DashboardLayoutProps {
  children?: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { signOut, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [fabModalOpen, setFabModalOpen] = useState(false);
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Resumen', icon: LayoutDashboard },
    { path: '/accounts', label: 'Cuentas', icon: CreditCard },
    { path: '/transactions', label: 'Transacciones', icon: TrendingUp },
    { path: '/subscriptions', label: 'Suscripciones', icon: CalendarRange },
    { path: '/forecast', label: 'Forecast', icon: BarChart3 },
    { path: '/administration', label: 'Administración', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <div
          className={`fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden transition-opacity duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          onClick={() => setSidebarOpen(false)}
        />

        <aside
          className={`fixed lg:sticky top-0 left-0 h-screen bg-surface border-r border-border z-40 transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            } lg:translate-x-0 w-64 flex-shrink-0`}
        >
          <div className="h-full flex flex-col">
            <div className="p-6">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary rounded-2xl flex items-center justify-center">
                    <Wallet className="w-6 h-6 text-primary-fg" />
                  </div>
                  <h1 className="text-xl font-bold text-text-main">FinanzasApp</h1>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="lg:hidden p-2 text-text-muted hover:text-text-main hover:bg-surface/50 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="space-y-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) =>
                        `w-full flex items-center gap-3 px-4 py-3 rounded-xl transition whitespace-nowrap ${isActive || (item.path === '/' && location.pathname === '/')
                          ? 'bg-primary/20 text-primary font-semibold'
                          : 'text-text-muted hover:bg-surface/50 hover:text-text-main'
                        }`
                      }
                      end={item.path === '/'}
                    >
                      <Icon className="w-5 h-5" />
                      {item.label}
                    </NavLink>
                  );
                })}
              </nav>
            </div>

            <div className="mt-auto p-6 border-t border-border space-y-2">
              <button
                onClick={toggleTheme}
                className="w-full flex items-center gap-3 px-4 py-3 text-text-muted hover:bg-surface/50 hover:text-text-main rounded-xl transition"
              >
                {theme === 'light' ? (
                  <Moon className="w-5 h-5" />
                ) : (
                  <Sun className="w-5 h-5" />
                )}
                <span>{theme === 'light' ? 'Modo Oscuro' : 'Modo Claro'}</span>
              </button>
              <button
                onClick={signOut}
                className="w-full flex items-center gap-3 px-4 py-3 text-text-muted hover:bg-surface/50 hover:text-text-main rounded-xl transition"
              >
                <LogOut className="w-5 h-5" />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </aside>

        <div className="flex-1 w-full lg:w-auto min-w-0">
          <div className="sticky top-0 z-30 bg-background border-b border-border">
            <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 text-text-muted hover:text-text-main hover:bg-surface/50 rounded-lg transition z-40"
              >
                <Menu className="w-6 h-6" />
              </button>
              <div className="flex items-center gap-4">
                <div className="hidden sm:block">
                  <QuickAddButton />
                </div>
                <div className="text-right">
                  <p className="text-xs sm:text-sm text-text-muted truncate max-w-[200px] sm:max-w-none">
                    {user?.email}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <main className="min-h-screen pb-24 lg:pb-0">
            {children || <Outlet />}
          </main>

          {/* Mobile FAB - Nuevo Movimiento */}
          <button
            onClick={() => setFabModalOpen(true)}
            className="lg:hidden fixed bottom-[5.5rem] right-5 z-50 w-14 h-14 bg-primary text-primary-fg rounded-full shadow-xl shadow-primary/30 flex items-center justify-center active:scale-95 transition-transform"
            aria-label="Nuevo Movimiento"
          >
            <PlusCircle className="w-7 h-7" />
          </button>
          {fabModalOpen && (
            <AddMovementModal onClose={() => setFabModalOpen(false)} />
          )}

          {/* Mobile Bottom Navigation */}
          <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-border safe-area-bottom">
            <div className="flex items-center justify-around h-16">
              {[
                { path: '/', label: 'Resumen', icon: LayoutDashboard },
                { path: '/accounts', label: 'Cuentas', icon: CreditCard },
                { path: '/transactions', label: 'Movimientos', icon: TrendingUp },
                { path: '/forecast', label: 'Forecast', icon: BarChart3 },
                { path: '#more', label: 'Más', icon: Menu },
              ].map((item) => {
                const Icon = item.icon;
                if (item.path === '#more') {
                  return (
                    <button
                      key="more"
                      onClick={() => setSidebarOpen(true)}
                      className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 text-text-muted active:text-primary transition-colors min-w-[4rem]"
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-[10px] font-medium">{item.label}</span>
                    </button>
                  );
                }
                const isActive = item.path === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.path);
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 transition-colors min-w-[4rem] ${isActive
                      ? 'text-primary'
                      : 'text-text-muted active:text-primary'
                      }`}
                    end={item.path === '/'}
                  >
                    <div className={`p-1 rounded-xl transition ${isActive ? 'bg-primary/15' : ''}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </nav>
        </div>
      </div>

      {/* AI Copilot - available on all pages */}
      <AICopilotPanel />
    </div>
  );
}
