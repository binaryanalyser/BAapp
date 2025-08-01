import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useTradingContext } from '../contexts/TradingContext';
import ErrorBoundary from '../components/UI/ErrorBoundary';
import AssetAnalysis from '../components/Trading/AssetAnalysis';
import AssetSelector from '../components/Trading/AssetSelector';
import { TrendingUp, TrendingDown, Activity, DollarSign, User, History, Clock, Target, Play, Pause } from 'lucide-react';

const TradingView: React.FC = () => {
  const { isAuthenticated, user, isLoading } = useAuth();
  const { isConnected, subscribeTo } = useWebSocket();
  const { stats: tradingStats, trades } = useTradingContext();
  const [selectedAsset, setSelectedAsset] = useState('R_10');
  const [selectedSymbols] = useState(['R_10', 'R_25', 'R_50', 'R_75', 'R_100']);
  const [activeTradeCountdowns, setActiveTradeCountdowns] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<'open' | 'closed'>('open');

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

  // Update countdowns for active trades
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const newCountdowns: Record<string, number> = {};
      
      trades.filter(trade => trade.status === 'open').forEach(trade => {
        const elapsed = Math.floor((now - trade.entryTime) / 1000);
        const duration = trade.duration || 300; // Default 5 minutes
        const remaining = Math.max(0, duration - elapsed);
        newCountdowns[trade.id] = remaining;
        
        // Show expiry warning when 10 seconds left
        if (remaining === 10 && remaining > 0) {
          console.log(`Trade ${trade.symbol} ${trade.type} expiring in 10 seconds!`);
        }
      });
      
      setActiveTradeCountdowns(newCountdowns);
    }, 1000);

    return () => clearInterval(interval);
  }, [trades]);

  // Filter trades based on active tab
  const openTrades = trades.filter(trade => trade.status === 'open');
  const closedTrades = trades.filter(trade => trade.status !== 'open');
  const displayTrades = activeTab === 'open' ? openTrades : closedTrades;

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

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTradeStatusColor = (status: 'won' | 'lost' | 'open') => {
    switch (status) {
      case 'won': return 'text-green-400 bg-green-500/10 border-green-500';
      case 'lost': return 'text-red-400 bg-red-500/10 border-red-500';
      case 'open': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500';
    }
  };

  const getTradeTypeIcon = (type: string) => {
    switch (type) {
      case 'CALL': return <TrendingUp className="h-4 w-4 text-green-400" />;
      case 'PUT': return <TrendingDown className="h-4 w-4 text-red-400" />;
      default: return <Target className="h-4 w-4 text-blue-400" />;
    }
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
        <div className="space-y-6">
          {/* Asset Selection */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <AssetSelector 
              selectedAsset={selectedAsset}
              onAssetChange={setSelectedAsset}
            />
            <ErrorBoundary>
              <AssetAnalysis selectedSymbol={selectedAsset} />
            </ErrorBoundary>
          </div>

          {/* Trade History - Full Width Below */}
          <div>
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <History className="h-6 w-6 text-blue-400" />
                  <h3 className="text-xl font-semibold text-white">Trades</h3>
                </div>
                <div className="text-sm text-gray-400">
                  {trades.length} total
                </div>
              </div>

              {/* Tabs */}
              <div className="flex space-x-1 mb-6 bg-gray-700 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('open')}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'open'
                      ? 'bg-gray-900 text-white border border-gray-500'
                      : 'text-gray-300 hover:text-white hover:bg-gray-600'
                  }`}
                >
                  Open Trades ({openTrades.length})
                </button>
                <button
                  onClick={() => setActiveTab('closed')}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'closed'
                      ? 'bg-gray-900 text-white border border-gray-500'
                      : 'text-gray-300 hover:text-white hover:bg-gray-600'
                  }`}
                >
                  Closed Trades ({closedTrades.length})
                </button>
              </div>
              
              {/* Trade Grid - Multiple columns on desktop */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto">
                {displayTrades.length === 0 ? (
                  <div className="col-span-full text-center py-8 text-gray-400">
                    <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No {activeTab} trades</p>
                    <p className="text-sm mt-1">
                      {activeTab === 'open' 
                        ? 'Start trading to see active positions' 
                        : 'Completed trades will appear here'}
                    </p>
                  </div>
                ) : (
                  displayTrades.map((trade) => {
                    const countdown = activeTradeCountdowns[trade.id];
                    const isActive = trade.status === 'open';
                    
                    return (
                      <div
                        key={trade.id}
                        className={`rounded-lg border p-4 transition-all ${getTradeStatusColor(trade.status)}`}
                      >
                        {/* Trade Header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            {getTradeTypeIcon(trade.type)}
                            <span className="font-medium text-white">{trade.symbol}</span>
                            <span className="text-xs bg-gray-700 px-2 py-1 rounded font-mono">
                              {trade.type}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            {isActive ? (
                              <div className="flex items-center space-x-1">
                                <Play className="h-3 w-3 text-green-400 animate-pulse" />
                                <span className="text-xs text-green-400">LIVE</span>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-1">
                                <Pause className="h-3 w-3 text-gray-400" />
                                <span className="text-xs text-gray-400">CLOSED</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Trade Details */}
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Stake:</span>
                            <span className="text-white font-mono">${trade.stake.toFixed(2)}</span>
                          </div>
                          
                          <div className="flex justify-between">
                            <span className="text-gray-400">Potential Payout:</span>
                            <span className="text-green-400 font-mono">${trade.payout.toFixed(2)}</span>
                          </div>
                          
                          {!isActive && (
                            <div className="flex justify-between">
                              <span className="text-gray-400">Profit/Loss:</span>
                              <span className={`font-mono ${trade.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {trade.profit >= 0 ? '+' : ''}${trade.profit.toFixed(2)}
                              </span>
                            </div>
                          )}
                          
                          <div className="flex justify-between">
                            <span className="text-gray-400">Entry Price:</span>
                            <span className="text-white font-mono">{trade.entryPrice?.toFixed(4) || '---'}</span>
                          </div>
                          
                          {trade.exitPrice && (
                            <div className="flex justify-between">
                              <span className="text-gray-400">Exit Price:</span>
                              <span className="text-white font-mono">{trade.exitPrice.toFixed(4)}</span>
                            </div>
                          )}
                        </div>

                        {/* Countdown Timer for Active Trades */}
                        {isActive && countdown !== undefined && (
                          <div className="mt-3 pt-3 border-t border-gray-600">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <Clock className="h-4 w-4 text-yellow-400" />
                                <span className="text-sm text-gray-400">Time Remaining:</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className="text-lg font-mono text-yellow-400">
                                  {formatCountdown(countdown)}
                                </span>
                                {countdown <= 30 && (
                                  <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                                )}
                              </div>
                            </div>
                            
                            {/* Progress Bar */}
                            <div className="mt-2">
                              <div className="w-full bg-gray-700 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full transition-all duration-1000 ${
                                    countdown <= 30 ? 'bg-red-400' : 
                                    countdown <= 60 ? 'bg-yellow-400' : 'bg-green-400'
                                  }`}
                                  style={{ 
                                    width: `${((trade.duration || 300) - countdown) / (trade.duration || 300) * 100}%` 
                                  }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Trade Timestamps */}
                        <div className="mt-3 pt-3 border-t border-gray-600 text-xs text-gray-500">
                          <div className="flex justify-between">
                            <span>Entry: {new Date(trade.entryTime).toLocaleTimeString()}</span>
                            {trade.exitTime && (
                              <span>Exit: {new Date(trade.exitTime).toLocaleTimeString()}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TradingView;