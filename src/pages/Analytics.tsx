import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTradingContext } from '../contexts/TradingContext';
import PerformanceChart from '../components/Analytics/PerformanceChart';
import TradingStats from '../components/Analytics/TradingStats';
import SignalAccuracy from '../components/Analytics/SignalAccuracy';
import RiskMetrics from '../components/Analytics/RiskMetrics';
import { User, RefreshCw, Download } from 'lucide-react';
import SEOHead from '../components/SEO/SEOHead';

const Analytics: React.FC = () => {
  const { isAuthenticated, user, isLoading } = useAuth();
  const { stats, syncWithDeriv, isLoading: tradesLoading } = useTradingContext();
  const [isSyncing, setIsSyncing] = React.useState(false);

  const handleSyncWithDeriv = async () => {
    setIsSyncing(true);
    try {
      await syncWithDeriv();
    } catch (error) {
      console.error('Failed to sync with Deriv:', error);
    } finally {
      setIsSyncing(false);
    }
  };

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
    <>
      <SEOHead 
        title="Trading Analytics - Binary Analyzer | Performance & Risk Analysis"
        description="Comprehensive trading analytics with performance metrics, risk analysis, signal accuracy tracking, and detailed trading statistics for binary options."
        url="https://binaryanalyser.com/analytics"
      />
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
          </div>
          <div className="flex items-center justify-between">
            <p className="text-gray-400">Detailed analysis of your trading performance and signal accuracy</p>
            <div className="text-sm text-gray-500">
              Total P&L: <span className={`font-bold ${stats.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {stats.totalProfit >= 0 ? '+' : ''}${stats.totalProfit.toFixed(2)}
              </span> | 
              Win Rate: <span className="font-bold text-blue-400">{stats.winRate.toFixed(1)}%</span>
            </div>
          </div>
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
    </>
  );
};

export default Analytics;