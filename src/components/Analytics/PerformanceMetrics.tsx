import React from 'react';
import { TrendingUp, Target, DollarSign, Activity } from 'lucide-react';

const PerformanceMetrics: React.FC = () => {
  const metrics = [
    {
      label: 'Total Trades',
      value: '247',
      change: '+12 this week',
      icon: Activity,
      color: 'text-blue-400'
    },
    {
      label: 'Win Rate',
      value: '68.4%',
      change: '+2.1% from last month',
      icon: Target,
      color: 'text-green-400'
    },
    {
      label: 'Avg. Profit',
      value: '$12.34',
      change: '+$1.23 from last month',
      icon: DollarSign,
      color: 'text-green-400'
    },
    {
      label: 'Best Streak',
      value: '15',
      change: 'Current: 3 wins',
      icon: TrendingUp,
      color: 'text-yellow-400'
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
            <span className="text-green-400 font-medium">+$45.67</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">This Week</span>
            <span className="text-green-400 font-medium">+$234.12</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">This Month</span>
            <span className="text-green-400 font-medium">+$1,234.56</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceMetrics;