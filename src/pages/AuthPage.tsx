import { useState } from 'react';
import { Wallet } from 'lucide-react';
import { LoginForm } from '../components/Auth/LoginForm';
import { SignUpForm } from '../components/Auth/SignUpForm';

export function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl flex gap-12 items-center">
        <div className="hidden lg:flex flex-1 flex-col">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
              <Wallet className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">FinanzasApp</h1>
          </div>
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Control total de tus finanzas personales
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Gestiona tus ingresos, gastos, tarjetas y proyecta tu futuro financiero en un solo lugar.
          </p>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <div className="w-2 h-2 bg-green-600 rounded-full"></div>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Múltiples cuentas</h3>
                <p className="text-gray-600">Gestiona tarjetas, cuentas de ahorro e inversiones</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <div className="w-2 h-2 bg-green-600 rounded-full"></div>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Proyecciones mensuales</h3>
                <p className="text-gray-600">Visualiza tus compras a crédito y gastos futuros</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <div className="w-2 h-2 bg-green-600 rounded-full"></div>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Seguimiento detallado</h3>
                <p className="text-gray-600">Categoriza y analiza todos tus movimientos</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex justify-center">
          {isLogin ? (
            <LoginForm onToggleForm={() => setIsLogin(false)} />
          ) : (
            <SignUpForm onToggleForm={() => setIsLogin(true)} />
          )}
        </div>
      </div>
    </div>
  );
}
