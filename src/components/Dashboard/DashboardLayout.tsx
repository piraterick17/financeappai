import { ReactNode, useState } from 'react';
import { Wallet, LayoutDashboard, CreditCard, TrendingUp, BarChart3, Settings, LogOut, Menu, X, Moon, Sun } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

interface DashboardLayoutProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function DashboardLayout({ children, activeTab, onTabChange }: DashboardLayoutProps) {
  const { signOut, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Resumen', icon: LayoutDashboard },
    { id: 'accounts', label: 'Cuentas', icon: CreditCard },
    { id: 'transactions', label: 'Transacciones', icon: TrendingUp },
    { id: 'forecast', label: 'Presupuestos', icon: BarChart3 },
    { id: 'administration', label: 'Administración', icon: Settings },
  ];

  const handleTabChange = (tab: string) => {
    onTabChange(tab);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <div
          className={`fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden transition-opacity duration-300 ${
            sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={() => setSidebarOpen(false)}
        />

        <aside
          className={`fixed lg:sticky top-0 left-0 h-screen bg-surface border-r border-border z-40 transition-transform duration-300 ease-in-out ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
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
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleTabChange(item.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition whitespace-nowrap ${
                        isActive
                          ? 'bg-primary/20 text-primary font-semibold'
                          : 'text-text-muted hover:bg-surface/50 hover:text-text-main'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      {item.label}
                    </button>
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
              <div className="text-right">
                <p className="text-xs sm:text-sm text-text-muted truncate max-w-[200px] sm:max-w-none">
                  {user?.email}
                </p>
              </div>
            </div>
          </div>

          <main className="min-h-screen">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
