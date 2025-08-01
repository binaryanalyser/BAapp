import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTradingContext } from '../contexts/TradingContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import LiveTicks from '../components/Trading/LiveTicks';
import { User, TrendingUp, TrendingDown, Activity, DollarSign } from 'lucide-react';

const Dashboard: React.FC = () => {
  const { isAuthenticated, user, isLoading } = useAuth();
  const { stats: tradingStats } = useTradingContext();
  const { isConnected, subscribeTo } = useWebSocket();
  const [selectedSymbols] = useState(['R_10', 'R_25', 'R_50', 'R_75', 'R_100']);

  // Move useEffect to top level, before any conditional returns
  useEffect(() => {
    if (isConnected) {
      selectedSymbols.forEach(symbol => subscribeTo(symbol));
    }
  }, [isConnected, subscribeTo]);

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading...</p>
          <p className="text-gray-400 text-sm">
            {user ? 'Loading dashboard...' : 'Checking authentication...'}
          </p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const metrics = [
    {
      name: 'Total Profit',
      value: `$${tradingStats.totalProfit.toFixed(2)}`,
      change: `${tradingStats.totalTrades} trades`,
      icon: DollarSign,
      color: tradingStats.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'
    },
    {
      name: 'Win Rate',
      value: `${tradingStats.winRate.toFixed(1)}%`,
      change: `${tradingStats.winningTrades}W / ${tradingStats.totalTrades - tradingStats.winningTrades}L`,
      icon: TrendingUp,
      color: tradingStats.winRate >= 60 ? 'text-green-400' : tradingStats.winRate >= 50 ? 'text-yellow-400' : 'text-red-400'
    },
    {
      name: 'Active Trades',
      value: tradingStats.activeTrades.toString(),
      change: tradingStats.activeTrades > 0 ? 'Live' : 'None',
      icon: Activity,
      color: 'text-blue-400'
    },
    {
      name: 'Today\'s P&L',
      value: `$${tradingStats.dailyProfit.toFixed(2)}`,
      change: tradingStats.dailyProfit >= 0 ? 'Profit' : 'Loss',
      icon: TrendingUp,
      color: tradingStats.dailyProfit >= 0 ? 'text-green-400' : 'text-red-400'
    }
  ];

  const parseChange = (changeStr: string) => {
    const isPositive = changeStr.includes('W') || changeStr.includes('Profit') || changeStr.includes('Live');
    return { isPositive };
  };

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <User className="h-8 w-8 text-blue-400" />
            <h1 className="text-3xl font-bold text-white">Welcome, {user?.loginid}! Analysis Overview</h1>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-gray-400">Monitor your performance and analyze market trends</p>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            const changeData = parseChange(metric.change);
            return (
              <div key={metric.name} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm font-medium">{metric.name}</p>
                    <p className="text-2xl font-bold text-white mt-2">{metric.value}</p>
                    <div className={`flex items-center space-x-1 text-sm mt-1 ${metric.color}`}>
                      {changeData.isPositive ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      <span>{metric.change}</span>
                    </div>
                  </div>
                  <Icon className={`h-8 w-8 ${metric.color}`} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Live Ticks */}
        <div className="grid grid-cols-1 gap-6 mt-6">
          <LiveTicks symbols={selectedSymbols} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;