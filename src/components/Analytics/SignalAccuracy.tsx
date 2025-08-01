import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis } from 'recharts';
import { Brain, TrendingUp, Activity } from 'lucide-react';

const SignalAccuracy: React.FC = () => {
  const data = [
    { name: 'Accurate', value: 72, color: '#10B981' },
    { name: 'Inaccurate', value: 28, color: '#EF4444' }
  ];

  const signalData = [
    { signal: 'CALL', accuracy: 78, total: 52, strength: 'HIGH' },
    { signal: 'PUT', accuracy: 71, total: 43, strength: 'HIGH' },
    { signal: 'MATCH', accuracy: 65, total: 28, strength: 'MEDIUM' },
    { signal: 'DIFFER', accuracy: 82, total: 19, strength: 'CRITICAL' }
  ];

  const performanceHistory = [
    { time: '9:00', accuracy: 65 },
    { time: '10:00', accuracy: 68 },
    { time: '11:00', accuracy: 71 },
    { time: '12:00', accuracy: 69 },
    { time: '13:00', accuracy: 74 },
    { time: '14:00', accuracy: 72 },
    { time: '15:00', accuracy: 76 }
  ];

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
                formatter={(value: any) => [`${value}%`, 'Accuracy']}
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
        
        <div className="text-center">
          <div className="text-3xl font-bold text-green-400">72%</div>
          <div className="text-gray-400 mt-1">Overall Accuracy</div>
          <div className="text-sm text-gray-500 mt-2">
            Based on 142 signals
          </div>
        </div>
      </div>

      {/* Performance Trend */}
      <div className="mb-6">
        <h4 className="text-lg font-medium text-white mb-3 flex items-center">
          <TrendingUp className="h-4 w-4 mr-2 text-green-400" />
          Today's Performance Trend
        </h4>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={performanceHistory}>
              <XAxis dataKey="time" stroke="#9CA3AF" fontSize={10} />
              <YAxis stroke="#9CA3AF" fontSize={10} domain={[60, 80]} />
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

      <div className="space-y-3">
        <h4 className="text-lg font-medium text-white">Live Signal Analysis</h4>
        {signalData.map((signal) => (
          <div key={signal.signal} className="flex items-center justify-between p-3 bg-gray-750 rounded-lg border-l-4 border-blue-500">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-white font-medium">{signal.signal}</span>
                <span className={`text-xs px-2 py-1 rounded ${
                  signal.strength === 'CRITICAL' ? 'bg-red-500/20 text-red-400' :
                  signal.strength === 'HIGH' ? 'bg-green-500/20 text-green-400' :
                  'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {signal.strength}
                </span>
              </div>
              <span className="text-gray-400 text-sm">({signal.total} signals analyzed)</span>
            </div>
            <div className="text-right">
              <div className={`font-bold ${signal.accuracy >= 70 ? 'text-green-400' : signal.accuracy >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                {signal.accuracy}%
              </div>
              <div className="text-xs text-gray-500">
                {signal.accuracy >= 75 ? 'Excellent' : signal.accuracy >= 65 ? 'Good' : 'Fair'}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Real-time Stats */}
      <div className="mt-6 pt-4 border-t border-gray-700">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-bold text-blue-400">15</div>
            <div className="text-xs text-gray-400">Active Signals</div>
          </div>
          <div>
            <div className="text-lg font-bold text-green-400">+5.2%</div>
            <div className="text-xs text-gray-400">Accuracy Trend</div>
          </div>
          <div>
            <div className="text-lg font-bold text-yellow-400">2.3s</div>
            <div className="text-xs text-gray-400">Avg Response</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignalAccuracy;