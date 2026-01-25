import { useState } from 'react';
import { DashboardLayout } from '../components/Dashboard/DashboardLayout';
import { DashboardOverview } from '../components/Dashboard/DashboardOverview';
import { AccountsList } from '../components/Accounts/AccountsList';
import { AccountDetailsView } from '../components/Accounts/AccountDetailsView';
import { EditAccountModal } from '../components/Accounts/EditAccountModal';
import { TransactionsList } from '../components/Transactions/TransactionsList';
import { ForecastView } from '../components/Forecast/ForecastView';
import { AdministrationPage } from './AdministrationPage';
import { Database } from '../lib/database.types';

type Account = Database['public']['Tables']['accounts']['Row'];

export function DashboardPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  const handleViewAccountDetails = (accountId: string) => {
    setSelectedAccountId(accountId);
  };

  const handleBackToAccounts = () => {
    setSelectedAccountId(null);
  };

  const handleEditAccount = (account: Account) => {
    setEditingAccount(account);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardOverview />;
      case 'accounts':
        if (selectedAccountId) {
          return (
            <AccountDetailsView
              accountId={selectedAccountId}
              onBack={handleBackToAccounts}
              onEdit={handleEditAccount}
            />
          );
        }
        return <AccountsList onViewDetails={handleViewAccountDetails} />;
      case 'transactions':
        return <TransactionsList />;
      case 'forecast':
        return <ForecastView />;
      case 'administration':
        return <AdministrationPage />;
      default:
        return <DashboardOverview />;
    }
  };

  return (
    <>
      <DashboardLayout activeTab={activeTab} onTabChange={(tab) => {
        setActiveTab(tab);
        setSelectedAccountId(null);
      }}>
        {renderContent()}
      </DashboardLayout>

      {editingAccount && (
        <EditAccountModal
          account={editingAccount}
          onClose={() => setEditingAccount(null)}
          onSuccess={() => {
            setEditingAccount(null);
            setSelectedAccountId(null);
          }}
        />
      )}
    </>
  );
}
