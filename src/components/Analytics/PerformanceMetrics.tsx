import React from 'react';
import { TrendingUp, Target, DollarSign, Activity } from 'lucide-react';
import { useTradingContext } from '../../contexts/TradingContext';

const PerformanceMetrics: React.FC = () => {
  const { trades, stats } = useTradingContext();

  // Calculate additional metrics
  // Trades are already filtered by account in TradingContext
  const completedTrades = trades.filter(trade => trade.status !== 'open');
  const avgProfit = completedTrades.length > 0 ? 
    completedTrades.reduce((sum, trade) => sum + trade.profit, 0) / completedTrades.length : 0;

  // Calculate best winning streak
  const calculateBestStreak = () => {
    let bestStreak = 0;
    let currentStreak = 0;
    
    completedTrades
      .sort((a, b) => (a.exitTime || 0) - (b.exitTime || 0))
      .forEach(trade => {
        if (trade.status === 'won') {
          currentStreak++;
          bestStreak = Math.max(bestStreak, currentStreak);
        } else {
          currentStreak = 0;
        }
      });
    
    return bestStreak;
  };

  // Calculate current streak
  const calculateCurrentStreak = () => {
    let currentStreak = 0;
    const recentTrades = completedTrades
      .sort((a, b) => (b.exitTime || 0) - (a.exitTime || 0))
      .slice(0, 10);
    
    for (const trade of recentTrades) {
      if (trade.status === 'won') {
        currentStreak++;
      } else {
        break;
      }
    }
    
    return currentStreak;
  };

  const bestStreak = calculateBestStreak();
  const currentStreak = calculateCurrentStreak();

  // Calculate weekly trades
  const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  // Trades are already filtered by account in TradingContext
  const weeklyTrades = trades.filter(trade => 
    trade.entryTime >= weekAgo
  ).length;

  const metrics = [
    {
      label: 'Total Trades',
      value: stats.totalTrades.toString(),
      change: `+${weeklyTrades} this week`,
      icon: Activity,
      color: 'text-blue-400'
    },
    {
      label: 'Win Rate',
      value: `${stats.winRate.toFixed(1)}%`,
      change: `${stats.winningTrades}W / ${stats.totalTrades - stats.winningTrades}L`,
      icon: Target,
      color: stats.winRate >= 60 ? 'text-green-400' : stats.winRate >= 50 ? 'text-yellow-400' : 'text-red-400'
    },
    {
      label: 'Avg. Profit',
      value: `$${avgProfit.toFixed(2)}`,
      change: avgProfit >= 0 ? `+$${Math.abs(avgProfit).toFixed(2)} per trade` : `-$${Math.abs(avgProfit).toFixed(2)} per trade`,
      icon: DollarSign,
      color: avgProfit >= 0 ? 'text-green-400' : 'text-red-400'
    },
    {
      label: 'Best Streak',
      value: bestStreak.toString(),
      change: `Current: ${currentStreak} ${currentStreak === 1 ? 'win' : 'wins'}`,
      icon: TrendingUp,
      color: currentStreak > 0 ? 'text-green-400' : 'text-yellow-400'
    }
  ];

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
      <h3 className="text-xl font-semibold text-white mb-6">Performance Overview</h3>
      
      <div className="grid grid-cols-2 gap-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className="bg-gray-750 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <Icon className={`h-5 w-5 ${metric.color}`} />
                <span className="text-2xl font-bold text-white">{metric.value}</span>
              </div>
              <div className="text-sm text-gray-400 mb-1">{metric.label}</div>
              <div className={`text-xs ${metric.color}`}>{metric.change}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-6 border-t border-gray-700">
        <h4 className="text-lg font-medium text-white mb-4">Recent Performance</h4>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Today</span>
            <span className={`font-medium ${stats.dailyProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {stats.dailyProfit >= 0 ? '+' : ''}${stats.dailyProfit.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">This Week</span>
            <span className={`font-medium ${stats.weeklyProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {stats.weeklyProfit >= 0 ? '+' : ''}${stats.weeklyProfit.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">This Month</span>
            <span className={`font-medium ${stats.monthlyProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {stats.monthlyProfit >= 0 ? '+' : ''}${stats.monthlyProfit.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceMetrics;