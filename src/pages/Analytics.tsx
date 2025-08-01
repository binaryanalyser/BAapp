import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import PerformanceChart from '../components/Analytics/PerformanceChart';
import TradingStats from '../components/Analytics/TradingStats';
import SignalAccuracy from '../components/Analytics/SignalAccuracy';
import RiskMetrics from '../components/Analytics/RiskMetrics';
import { User } from 'lucide-react';

const Analytics: React.FC = () => {
  const { isAuthenticated, user, isLoading } = useAuth();

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading...</p>
          <p className="text-gray-400 text-sm">
            {user ? 'Loading analytics...' : 'Checking authentication...'}
          </p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <User className="h-8 w-8 text-blue-400" />
            <h1 className="text-3xl font-bold text-white">Analytics & Performance</h1>
          </div>
          <p className="text-gray-400">Detailed analysis of your trading performance and signal accuracy</p>
        </div>

        {/* Performance Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <PerformanceChart />
          <SignalAccuracy />
        </div>

        {/* Detailed Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TradingStats />
          <RiskMetrics />
        </div>
      </div>
    </div>
  );
};

export default Analytics;