import { useState } from 'react';
import { CategoriesManagement } from '../components/Administration/CategoriesManagement';
import { SuppliersManagement } from '../components/Administration/SuppliersManagement';
import { BanksManagement } from '../components/Administration/BanksManagement';

export function AdministrationPage() {
  const [activeTab, setActiveTab] = useState('categories');

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-text-main text-2xl sm:text-3xl lg:text-4xl font-black leading-tight tracking-tight">
          Administración
        </h1>
        <p className="text-text-muted text-sm sm:text-base mt-2">
          Gestiona categorías, proveedores y configuración general
        </p>
      </header>

      <div className="bg-surface rounded-xl border border-border">
        <div className="border-b border-border">
          <div className="flex overflow-x-auto">
            <button
              onClick={() => setActiveTab('categories')}
              className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition ${
                activeTab === 'categories'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              Categorías
            </button>
            <button
              onClick={() => setActiveTab('suppliers')}
              className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition ${
                activeTab === 'suppliers'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              Proveedores
            </button>
            <button
              onClick={() => setActiveTab('banks')}
              className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition ${
                activeTab === 'banks'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              Bancos
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {activeTab === 'categories' && <CategoriesManagement />}
          {activeTab === 'suppliers' && <SuppliersManagement />}
          {activeTab === 'banks' && <BanksManagement />}
        </div>
      </div>
    </div>
  );
}
