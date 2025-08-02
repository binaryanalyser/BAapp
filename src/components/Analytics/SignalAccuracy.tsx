import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis } from 'recharts';
import { Brain, TrendingUp, Activity } from 'lucide-react';
import { useTradingContext } from '../../contexts/TradingContext';

const SignalAccuracy: React.FC = () => {
  const { trades, stats } = useTradingContext();

  // Calculate signal accuracy from actual trades
  const calculateAccuracy = () => {
    const completedTrades = trades.filter(trade => trade.status !== 'open');
    if (completedTrades.length === 0) {
      return {
        accurate: 0,
        inaccurate: 0,
        total: 0,
        percentage: 0
      };
    }

    const accurate = completedTrades.filter(trade => trade.status === 'won').length;
    const inaccurate = completedTrades.filter(trade => trade.status === 'lost').length;
    const total = accurate + inaccurate;
    const percentage = total > 0 ? (accurate / total) * 100 : 0;

    return { accurate, inaccurate, total, percentage };
  };

  const accuracy = calculateAccuracy();
  
  const data = [
    { name: 'Accurate', value: accuracy.percentage, color: '#10B981' },
    { name: 'Inaccurate', value: 100 - accuracy.percentage, color: '#EF4444' }
  ];

  // Calculate signal data by type
  const calculateSignalData = () => {
    const completedTrades = trades.filter(trade => trade.status !== 'open');
    const signalTypes = ['CALL', 'PUT', 'DIGITMATCH', 'DIGITDIFF'];
    
    return signalTypes.map(type => {
      const typeTrades = completedTrades.filter(trade => trade.type === type);
      const wins = typeTrades.filter(trade => trade.status === 'won').length;
      const total = typeTrades.length;
      const accuracy = total > 0 ? (wins / total) * 100 : 0;
      
      let strength: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      if (accuracy >= 80) strength = 'CRITICAL';
      else if (accuracy >= 70) strength = 'HIGH';
      else if (accuracy >= 60) strength = 'MEDIUM';
      else strength = 'LOW';
      
      return {
        signal: type === 'DIGITMATCH' ? 'MATCH' : type === 'DIGITDIFF' ? 'DIFFER' : type,
        accuracy: accuracy,
        total: total,
        strength: strength
      };
    }).filter(data => data.total > 0);
  };

  const signalData = calculateSignalData();

  // Generate performance history from recent trades
  const generatePerformanceHistory = () => {
    const completedTrades = trades
      .filter(trade => trade.status !== 'open' && trade.exitTime)
      .sort((a, b) => a.exitTime! - b.exitTime!)
      .slice(-20); // Last 20 trades

    if (completedTrades.length < 5) {
      return [{ time: 'Now', accuracy: accuracy.percentage }];
    }

    const history: Array<{ time: string; accuracy: number }> = [];
    const chunkSize = Math.max(1, Math.floor(completedTrades.length / 7));
    
    for (let i = 0; i < completedTrades.length; i += chunkSize) {
      const chunk = completedTrades.slice(i, i + chunkSize);
      const wins = chunk.filter(trade => trade.status === 'won').length;
      const chunkAccuracy = (wins / chunk.length) * 100;
      const time = new Date(chunk[chunk.length - 1].exitTime!).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      history.push({ time, accuracy: chunkAccuracy });
    }
    
    return history.slice(-7); // Last 7 data points
  };

  const performanceHistory = generatePerformanceHistory();

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
      <div className="flex items-center space-x-3 mb-6">
        <Brain className="h-6 w-6 text-blue-400" />
        <h3 className="text-xl font-semibold text-white">AI Signal Performance</h3>
        <div className="flex items-center space-x-1">
          <Activity className="h-4 w-4 text-green-400 animate-pulse" />
          <span className="text-xs text-green-400">Live Tracking</span>
        </div>
      </div>
      
      <div className="flex items-center justify-between mb-6">
        {accuracy.total > 0 ? (
          <div className="w-48 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: any) => [`${value.toFixed(1)}%`, 'Accuracy']}
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '6px',
                    color: '#F9FAFB'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="w-48 h-48 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <Brain className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No data yet</p>
            </div>
          </div>
        )}
        
        <div className="text-center">
          <div className={`text-3xl font-bold ${
            accuracy.percentage >= 70 ? 'text-green-400' : 
            accuracy.percentage >= 60 ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {accuracy.percentage.toFixed(1)}%
          </div>
          <div className="text-gray-400 mt-1">Overall Accuracy</div>
          <div className="text-sm text-gray-500 mt-2">
            Based on {accuracy.total} signals
          </div>
        </div>
      </div>

      {/* Performance Trend */}
      {performanceHistory.length > 1 && (
        <div className="mb-6">
          <h4 className="text-lg font-medium text-white mb-3 flex items-center">
            <TrendingUp className="h-4 w-4 mr-2 text-green-400" />
            Recent Performance Trend
          </h4>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={performanceHistory}>
                <XAxis dataKey="time" stroke="#9CA3AF" fontSize={10} />
                <YAxis stroke="#9CA3AF" fontSize={10} domain={[0, 100]} />
                <Tooltip 
                  formatter={(value: any) => [`${value.toFixed(1)}%`, 'Accuracy']}
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '6px',
                    color: '#F9FAFB'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="accuracy" 
                  stroke="#10B981" 
                  strokeWidth={2}
                  dot={{ fill: '#10B981', r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {signalData.length > 0 ? (
        <div className="space-y-3">
          <h4 className="text-lg font-medium text-white">Signal Type Analysis</h4>
          {signalData.map((signal) => (
            <div key={signal.signal} className="flex items-center justify-between p-3 bg-gray-750 rounded-lg border-l-4 border-blue-500">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-white font-medium">{signal.signal}</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    signal.strength === 'CRITICAL' ? 'bg-red-500/20 text-red-400' :
                    signal.strength === 'HIGH' ? 'bg-green-500/20 text-green-400' :
                    signal.strength === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {signal.strength}
                  </span>
                </div>
                <span className="text-gray-400 text-sm">({signal.total} trades)</span>
              </div>
              <div className="text-right">
                <div className={`font-bold ${
                  signal.accuracy >= 70 ? 'text-green-400' : 
                  signal.accuracy >= 60 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {signal.accuracy.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500">
                  {signal.accuracy >= 75 ? 'Excellent' : 
                   signal.accuracy >= 65 ? 'Good' : 
                   signal.accuracy >= 50 ? 'Fair' : 'Poor'}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-400">
          <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No signal data available yet</p>
          <p className="text-sm mt-1">Complete some trades to see signal analysis</p>
        </div>
      )}

      {/* Real-time Stats */}
      <div className="mt-6 pt-4 border-t border-gray-700">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-bold text-blue-400">{stats.activeTrades}</div>
            <div className="text-xs text-gray-400">Active Trades</div>
          </div>
          <div>
            <div className={`text-lg font-bold ${
              accuracy.percentage >= 70 ? 'text-green-400' : 
              accuracy.percentage >= 60 ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {accuracy.percentage.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-400">Current Accuracy</div>
          </div>
          <div>
            <div className="text-lg font-bold text-yellow-400">{stats.totalTrades}</div>
            <div className="text-xs text-gray-400">Total Signals</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignalAccuracy;