import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from './contexts/AuthContext';
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
  const isLoginPage = location.pathname === '/login';

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
    <HelmetProvider>
    <AuthProvider>
      <TradingProvider>
        <WebSocketProvider>
          <Router>
            <AppContent />
          </Router>
        </WebSocketProvider>
      </TradingProvider>
    </AuthProvider>
    </HelmetProvider>
  );
}

export default App;