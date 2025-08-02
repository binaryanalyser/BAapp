import React from 'react';
import { Shield, AlertTriangle, TrendingDown } from 'lucide-react';
import { useTradingContext } from '../../contexts/TradingContext';

const RiskMetrics: React.FC = () => {
  const { trades, stats } = useTradingContext();

  // Calculate risk metrics from actual trades
  const calculateRiskMetrics = () => {
    const completedTrades = trades.filter(trade => trade.status !== 'open');
    
    if (completedTrades.length === 0) {
      return {
        maxDrawdown: 0,
        riskReward: 0,
        riskScore: 5,
        avgStake: 0,
        maxStake: 0,
        consecutiveLosses: 0
      };
    }

    // Calculate max drawdown
    let runningProfit = 0;
    let peak = 0;
    let maxDrawdown = 0;
    
    completedTrades
      .sort((a, b) => (a.exitTime || 0) - (b.exitTime || 0))
      .forEach(trade => {
        runningProfit += trade.profit;
        peak = Math.max(peak, runningProfit);
        const drawdown = peak - runningProfit;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
      });

    // Calculate risk/reward ratio
    const winningTrades = completedTrades.filter(trade => trade.status === 'won');
    const losingTrades = completedTrades.filter(trade => trade.status === 'lost');
    
    const avgWin = winningTrades.length > 0 ? 
      winningTrades.reduce((sum, trade) => sum + trade.profit, 0) / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? 
      Math.abs(losingTrades.reduce((sum, trade) => sum + trade.profit, 0)) / losingTrades.length : 0;
    
    const riskReward = avgLoss > 0 ? avgWin / avgLoss : 0;

    // Calculate other metrics
    const avgStake = completedTrades.reduce((sum, trade) => sum + trade.stake, 0) / completedTrades.length;
    const maxStake = Math.max(...completedTrades.map(trade => trade.stake));
    
    // Calculate consecutive losses
    let consecutiveLosses = 0;
    let currentStreak = 0;
    completedTrades
      .sort((a, b) => (b.exitTime || 0) - (a.exitTime || 0))
      .forEach(trade => {
        if (trade.status === 'lost') {
          currentStreak++;
          consecutiveLosses = Math.max(consecutiveLosses, currentStreak);
        } else {
          currentStreak = 0;
        }
      });

    // Calculate risk score (1-10, lower is better)
    let riskScore = 5; // Base score
    
    // Adjust based on win rate
    if (stats.winRate > 70) riskScore -= 2;
    else if (stats.winRate < 50) riskScore += 2;
    
    // Adjust based on drawdown
    if (maxDrawdown > avgStake * 10) riskScore += 2;
    else if (maxDrawdown < avgStake * 3) riskScore -= 1;
    
    // Adjust based on consecutive losses
    if (consecutiveLosses > 5) riskScore += 1;
    
    riskScore = Math.max(1, Math.min(10, riskScore));

    return {
      maxDrawdown,
      riskReward,
      riskScore,
      avgStake,
      maxStake,
      consecutiveLosses
    };
  };

  const riskData = calculateRiskMetrics();
  
  const getRiskScoreLabel = (score: number) => {
    if (score <= 3) return 'Low';
    if (score <= 6) return 'Medium';
    return 'High';
  };

  const getRiskScoreColor = (score: number) => {
    if (score <= 3) return { color: 'text-green-400', bgColor: 'bg-green-500/10' };
    if (score <= 6) return { color: 'text-yellow-400', bgColor: 'bg-yellow-500/10' };
    return { color: 'text-red-400', bgColor: 'bg-red-500/10' };
  };

  const riskScoreStyle = getRiskScoreColor(riskData.riskScore);

  const metrics = [
    {
      label: 'Risk Score',
      value: getRiskScoreLabel(riskData.riskScore),
      detail: `${riskData.riskScore.toFixed(1)}/10`,
      icon: Shield,
      color: riskScoreStyle.color,
      bgColor: riskScoreStyle.bgColor
    },
    {
      label: 'Max Drawdown',
      value: `-$${riskData.maxDrawdown.toFixed(2)}`,
      detail: riskData.avgStake > 0 ? `${((riskData.maxDrawdown / riskData.avgStake) * 100).toFixed(1)}% of avg stake` : 'No data',
      icon: TrendingDown,
      color: 'text-red-400',
      bgColor: 'bg-red-500/10'
    },
    {
      label: 'Risk/Reward',
      value: riskData.riskReward > 0 ? `1:${riskData.riskReward.toFixed(2)}` : 'N/A',
      detail: 'Avg. ratio',
      icon: AlertTriangle,
      color: riskData.riskReward >= 1.5 ? 'text-green-400' : riskData.riskReward >= 1 ? 'text-yellow-400' : 'text-red-400',
      bgColor: riskData.riskReward >= 1.5 ? 'bg-green-500/10' : riskData.riskReward >= 1 ? 'bg-yellow-500/10' : 'bg-red-500/10'
    }
  ];

  // Calculate risk factors based on actual trading behavior
  const calculateRiskFactors = () => {
    const completedTrades = trades.filter(trade => trade.status !== 'open');
    
    if (completedTrades.length === 0) {
      return [
        { factor: 'Position Sizing', score: 5, status: 'No Data' },
        { factor: 'Diversification', score: 5, status: 'No Data' },
        { factor: 'Win Rate', score: 5, status: 'No Data' },
        { factor: 'Risk Management', score: 5, status: 'No Data' }
      ];
    }

    // Position Sizing (consistency of stake amounts)
    const stakes = completedTrades.map(trade => trade.stake);
    const avgStake = stakes.reduce((a, b) => a + b, 0) / stakes.length;
    const stakeVariance = stakes.reduce((sum, stake) => sum + Math.pow(stake - avgStake, 2), 0) / stakes.length;
    const stakeCV = Math.sqrt(stakeVariance) / avgStake; // Coefficient of variation
    const positionSizingScore = Math.max(1, Math.min(10, 10 - (stakeCV * 20))); // Lower variance = higher score

    // Diversification (number of different symbols traded)
    const uniqueSymbols = new Set(completedTrades.map(trade => trade.symbol)).size;
    const diversificationScore = Math.min(10, uniqueSymbols * 2); // More symbols = higher score

    // Win Rate Score
    const winRateScore = Math.min(10, stats.winRate / 10);

    // Risk Management (based on consecutive losses and drawdown)
    let riskManagementScore = 8;
    if (riskData.consecutiveLosses > 5) riskManagementScore -= 3;
    if (riskData.maxDrawdown > riskData.avgStake * 10) riskManagementScore -= 2;
    riskManagementScore = Math.max(1, riskManagementScore);

    return [
      { 
        factor: 'Position Sizing', 
        score: Math.round(positionSizingScore), 
        status: positionSizingScore >= 8 ? 'Good' : positionSizingScore >= 6 ? 'Fair' : 'Poor' 
      },
      { 
        factor: 'Diversification', 
        score: Math.round(diversificationScore), 
        status: diversificationScore >= 8 ? 'Good' : diversificationScore >= 6 ? 'Fair' : 'Poor' 
      },
      { 
        factor: 'Win Rate', 
        score: Math.round(winRateScore), 
        status: winRateScore >= 8 ? 'Good' : winRateScore >= 6 ? 'Fair' : 'Poor' 
      },
      { 
        factor: 'Risk Management', 
        score: Math.round(riskManagementScore), 
        status: riskManagementScore >= 8 ? 'Good' : riskManagementScore >= 6 ? 'Fair' : 'Poor' 
      }
    ];
  };

  const riskFactors = calculateRiskFactors();

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-400';
    if (score >= 6) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getScoreWidth = (score: number) => {
    return `${(score / 10) * 100}%`;
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
      <h3 className="text-xl font-semibold text-white mb-6">Risk Management</h3>
      
      {/* Risk Metrics Cards */}
      <div className="grid grid-cols-1 gap-4 mb-6">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className={`rounded-lg p-4 ${metric.bgColor}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Icon className={`h-5 w-5 ${metric.color}`} />
                  <div>
                    <div className="text-gray-300 text-sm">{metric.label}</div>
                    <div className={`font-bold ${metric.color}`}>{metric.value}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-gray-400 text-xs">{metric.detail}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Risk Factors */}
      <div className="pt-6 border-t border-gray-700">
        <h4 className="text-lg font-medium text-white mb-4">Risk Factors Analysis</h4>
        <div className="space-y-4">
          {riskFactors.map((factor) => (
            <div key={factor.factor}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-300 text-sm">{factor.factor}</span>
                <div className="flex items-center space-x-2">
                  <span className={`text-sm font-medium ${getScoreColor(factor.score)}`}>
                    {factor.status}
                  </span>
                  <span className="text-gray-400 text-sm">{factor.score}/10</span>
                </div>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    factor.score >= 8 ? 'bg-green-400' : 
                    factor.score >= 6 ? 'bg-yellow-400' : 'bg-red-400'
                  }`}
                  style={{ width: getScoreWidth(factor.score) }}
                ></div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Additional Risk Insights */}
        {trades.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-600">
            <h5 className="text-md font-medium text-white mb-3">Risk Insights</h5>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-gray-750 rounded p-3">
                <div className="text-gray-400">Max Consecutive Losses</div>
                <div className={`font-bold ${riskData.consecutiveLosses > 5 ? 'text-red-400' : 'text-green-400'}`}>
                  {riskData.consecutiveLosses}
                </div>
              </div>
              <div className="bg-gray-750 rounded p-3">
                <div className="text-gray-400">Largest Single Stake</div>
                <div className="font-bold text-white">${riskData.maxStake.toFixed(2)}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RiskMetrics;