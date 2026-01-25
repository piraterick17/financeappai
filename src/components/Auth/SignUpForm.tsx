import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface SignUpFormProps {
  onToggleForm: () => void;
}

export function SignUpForm({ onToggleForm }: SignUpFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      setLoading(false);
      return;
    }

    const { error: authError } = await signUp(email, password, fullName);

    if (authError) {
      setError(authError.message);
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-8 bg-white rounded-2xl shadow-xl">
      <h2 className="text-3xl font-bold text-gray-900 mb-2">Crear cuenta</h2>
      <p className="text-gray-600 mb-8">Comienza a gestionar tus finanzas hoy</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
            Nombre completo
          </label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            placeholder="Juan Pérez"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
            Correo electrónico
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            placeholder="tu@email.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            placeholder="••••••••"
          />
          <p className="text-xs text-gray-500 mt-1">Mínimo 6 caracteres</p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-gray-600">
          ¿Ya tienes cuenta?{' '}
          <button
            onClick={onToggleForm}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Inicia sesión
          </button>
        </p>
      </div>
    </div>
  );
}
