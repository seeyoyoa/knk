import { AppProvider, useApp } from './store';
import Shop from './components/Shop';
import UserPanel from './components/UserPanel';
import AdminPanel from './components/AdminPanel';
import AdminLogin from './components/AdminLogin';
import CustomerService from './components/CustomerService';
import ErrorBoundary from './components/ErrorBoundary';

function AppContent() {
  const { currentView, adminAuth } = useApp();

  // 管理后台需要登录验证
  if (currentView === 'admin') {
    if (!adminAuth.isAuthenticated) {
      return <AdminLogin />;
    }
    return <AdminPanel />;
  }

  if (currentView === 'userpanel') {
    return (
      <>
        <UserPanel />
        <CustomerService />
      </>
    );
  }

  return (
    <>
      <Shop />
      <CustomerService />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  );
}
