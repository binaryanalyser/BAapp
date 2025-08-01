import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const PerformanceChart: React.FC = () => {
  const data = [
    { date: '1/1', profit: 0 },
    { date: '1/2', profit: 45 },
    { date: '1/3', profit: 23 },
    { date: '1/4', profit: 67 },
    { date: '1/5', profit: 123 },
    { date: '1/6', profit: 89 },
    { date: '1/7', profit: 156 },
    { date: '1/8', profit: 234 },
    { date: '1/9', profit: 178 },
    { date: '1/10', profit: 267 },
    { date: '1/11', profit: 345 },
    { date: '1/12', profit: 289 },
    { date: '1/13', profit: 456 },
    { date: '1/14', profit: 523 }
  ];

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
      <h3 className="text-xl font-semibold text-white mb-6">Profit & Loss Chart</h3>
      
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="date" 
              stroke="#9CA3AF"
              fontSize={12}
            />
            <YAxis 
              stroke="#9CA3AF"
              fontSize={12}
              tickFormatter={(value) => `$${value}`}
            />
            <Tooltip 
              formatter={(value: any) => [`$${value}`, 'Profit']}
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '6px',
                color: '#F9FAFB'
              }}
            />
            <Line 
              type="monotone" 
              dataKey="profit" 
              stroke="#10B981" 
              strokeWidth={3}
              dot={{ fill: '#10B981', r: 4 }}
              activeDot={{ r: 6, fill: '#10B981' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-2xl font-bold text-green-400">$523</div>
          <div className="text-sm text-gray-400">Total Profit</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-blue-400">14</div>
          <div className="text-sm text-gray-400">Trading Days</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-yellow-400">$37.36</div>
          <div className="text-sm text-gray-400">Avg. Daily</div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceChart;