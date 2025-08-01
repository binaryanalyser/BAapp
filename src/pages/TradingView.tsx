import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useTradingContext } from '../contexts/TradingContext';
import AssetAnalysis from '../components/Trading/AssetAnalysis';
import AssetSelector from '../components/Trading/AssetSelector';
import TradeHistory from '../components/Trading/TradeHistory';
import { TrendingUp, TrendingDown, Activity, DollarSign, User } from 'lucide-react';

const TradingView: React.FC = () => {
  const { isAuthenticated, user, isLoading } = useAuth();
  const { isConnected, subscribeTo } = useWebSocket();
  const { stats: tradingStats, trades } = useTradingContext();
  const [selectedAsset, setSelectedAsset] = useState('R_10');
  const [selectedSymbols] = useState(['R_10', 'R_25', 'R_50', 'R_75', 'R_100']);

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading...</p>
          <p className="text-gray-400 text-sm">
            {user ? 'Loading signals...' : 'Checking authentication...'}
          </p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  useEffect(() => {
    if (isConnected) {
      selectedSymbols.forEach(symbol => subscribeTo(symbol));
      subscribeTo(selectedAsset);
    }
  }, [isConnected, subscribeTo, selectedAsset]);

  const metrics = [
    {
      name: 'Total Profit',
      value: `$${tradingStats.totalProfit.toFixed(2)}`,
      change: `${tradingStats.totalProfit >= 0 ? '+' : ''}${((tradingStats.totalProfit / (user?.balance || 1000)) * 100).toFixed(1)}%`,
      icon: DollarSign,
      color: tradingStats.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'
    },
    {
      name: 'Win Rate',
      value: `${tradingStats.winRate.toFixed(1)}%`,
      change: `${tradingStats.totalTrades} trades`,
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
      name: 'Today\'s Signals',
      value: tradingStats.todaySignals.toString(),
      change: `+${Math.floor(tradingStats.todaySignals * 0.2)} new`,
      icon: TrendingDown,
      color: 'text-yellow-400'
    }
  ];

  const parseChange = (changeStr: string) => {
    const isPositive = changeStr.startsWith('+');
    const numericValue = parseFloat(changeStr.replace(/[+%]/g, ''));
    return { isPositive, numericValue };
  };

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <User className="h-8 w-8 text-blue-400" />
            <h1 className="text-3xl font-bold text-white">
              AI Trading Signals
            </h1>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-gray-400">Execute trades with AI-powered signals and real-time analysis</p>
            <div className="text-sm text-gray-500">
              App Trades: {trades.length} | Active: {tradingStats.activeTrades}
            </div>
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

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Asset Selection */}
          <div>
            <AssetSelector 
              selectedAsset={selectedAsset}
              onAssetChange={setSelectedAsset}
            />
          </div>

          {/* Asset Analysis */}
          <div className="lg:col-span-1">
            <AssetAnalysis selectedAsset={selectedAsset} />
          </div>
        </div>

        {/* Bottom Grid */}
        <div className="grid grid-cols-1 gap-6 mt-6">
          {/* Trade History */}
          <div>
            <TradeHistory />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TradingView;