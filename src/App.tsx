import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/AuthContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { TradingProvider } from './contexts/TradingContext';
import Header from './components/Layout/Header';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import OAuthCallback from './pages/OAuthCallback';
import TradingView from './pages/TradingView';
import Analytics from './pages/Analytics';
import { Toaster } from './components/UI/Toaster';

const AppContent: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const isLoginPage = location.pathname === '/login';

  React.useEffect(() => {
    if (!isAuthenticated && !isLoginPage && location.pathname !== '/oauth-callback') {
      navigate('/login');
    }
  }, [isAuthenticated, isLoginPage, location.pathname, navigate]);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {!isLoginPage && <Header />}
      <main className={isLoginPage ? '' : 'pt-16'}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/login" element={<Login />} />
          <Route path="/oauth-callback" element={<OAuthCallback />} />
          <Route path="/trading" element={<TradingView />} />
          <Route path="/analytics" element={<Analytics />} />
        </Routes>
      </main>
      <Toaster />
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <TradingProvider>
        <WebSocketProvider>
          <Router>
            <AppContent />
          </Router>
        </WebSocketProvider>
      </TradingProvider>
    </AuthProvider>
  );
}

export default App;