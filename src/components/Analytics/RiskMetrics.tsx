import React from 'react';
import { Shield, AlertTriangle, TrendingDown } from 'lucide-react';

const RiskMetrics: React.FC = () => {
  const metrics = [
    {
      label: 'Risk Score',
      value: 'Medium',
      detail: '6.2/10',
      icon: Shield,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10'
    },
    {
      label: 'Max Drawdown',
      value: '-$127.45',
      detail: '5.2% of balance',
      icon: TrendingDown,
      color: 'text-red-400',
      bgColor: 'bg-red-500/10'
    },
    {
      label: 'Risk/Reward',
      value: '1:1.85',
      detail: 'Avg. ratio',
      icon: AlertTriangle,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10'
    }
  ];

  const riskFactors = [
    { factor: 'Position Sizing', score: 8, status: 'Good' },
    { factor: 'Diversification', score: 6, status: 'Fair' },
    { factor: 'Stop Loss Usage', score: 4, status: 'Poor' },
    { factor: 'Risk Per Trade', score: 7, status: 'Good' }
  ];

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
      </div>
    </div>
  );
};

export default RiskMetrics;