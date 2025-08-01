import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const TradingStats: React.FC = () => {
  const contractData = [
    { type: 'CALL', wins: 45, losses: 23 },
    { type: 'PUT', wins: 38, losses: 19 },
    { type: 'MATCH', wins: 12, losses: 8 },
    { type: 'DIFFER', wins: 15, losses: 11 }
  ];

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
      <h3 className="text-xl font-semibold text-white mb-6">Trading Statistics</h3>
      
      <div className="h-64 mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={contractData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="type" 
              stroke="#9CA3AF"
              fontSize={12}
            />
            <YAxis 
              stroke="#9CA3AF"
              fontSize={12}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '6px',
                color: '#F9FAFB'
              }}
            />
            <Bar dataKey="wins" fill="#10B981" name="Wins" />
            <Bar dataKey="losses" fill="#EF4444" name="Losses" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {contractData.map((contract) => {
          const total = contract.wins + contract.losses;
          const winRate = ((contract.wins / total) * 100).toFixed(1);
          
          return (
            <div key={contract.type} className="bg-gray-750 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-white font-medium">{contract.type}</span>
                <span className="text-green-400 font-bold">{winRate}%</span>
              </div>
              <div className="text-sm text-gray-400">
                {contract.wins}W / {contract.losses}L ({total} total)
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TradingStats;