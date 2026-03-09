import { Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from '../components/Dashboard/DashboardLayout';
import { DashboardOverview } from '../components/Dashboard/DashboardOverview';
import { AccountsList } from '../components/Accounts/AccountsList';
import { AccountDetailsView } from '../components/Accounts/AccountDetailsView';
import { TransactionsList } from '../components/Transactions/TransactionsList';
import { ForecastView } from '../components/Forecast/ForecastView';
import { AdministrationPage } from './AdministrationPage';
import { SubscriptionsPage } from './SubscriptionsPage';
import { TransactionsLandingPage } from './TransactionsLandingPage';

export function DashboardPage() {
  return (
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route index element={<DashboardOverview />} />
        <Route path="accounts" element={<AccountsList onViewDetails={() => { }} />} />
        <Route path="accounts/:accountId" element={<AccountDetailsWrapper />} />
        <Route path="transactions" element={<TransactionsLandingPage />} />
        <Route path="transactions/history" element={<TransactionsList />} />
        <Route path="budget" element={<Navigate to="/forecast" replace />} />
        <Route path="forecast" element={<ForecastView />} />
        <Route path="subscriptions" element={<SubscriptionsPage />} />
        <Route path="administration" element={<AdministrationPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

import { useParams, useNavigate } from 'react-router-dom';

function AccountDetailsWrapper() {
  const { accountId } = useParams();
  const navigate = useNavigate();

  if (!accountId) return <Navigate to="/accounts" />;

  return (
    <AccountDetailsView
      accountId={accountId}
      onBack={() => navigate('/accounts')}
    />
  );
}
