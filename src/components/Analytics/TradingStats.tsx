import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTradingContext } from '../../contexts/TradingContext';

const TradingStats: React.FC = () => {
  const { trades } = useTradingContext();

  // Calculate real contract data from trades
  const calculateContractData = () => {
    // Trades are already filtered by account in TradingContext
    const completedTrades = trades.filter(trade => trade.status !== 'open');
    const contractTypes = ['CALL', 'PUT', 'DIGITMATCH', 'DIGITDIFF'];
    
    return contractTypes.map(type => {
      const typeTrades = completedTrades.filter(trade => trade.type === type);
      const wins = typeTrades.filter(trade => trade.status === 'won').length;
      const losses = typeTrades.filter(trade => trade.status === 'lost').length;
      
      return {
        type: type === 'DIGITMATCH' ? 'MATCH' : type === 'DIGITDIFF' ? 'DIFFER' : type,
        wins,
        losses,
        total: wins + losses,
        winRate: wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0
      };
    }).filter(data => data.total > 0); // Only show types that have been traded
  };

  const contractData = calculateContractData();

  // If no data, show placeholder
  if (contractData.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h3 className="text-xl font-semibold text-white mb-6">Trading Statistics</h3>
        
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <BarChart className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">No completed trades yet</p>
            <p className="text-sm">Start trading to see your statistics</p>
          </div>
        </div>
      </div>
    );
  }

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
              formatter={(value: any, name: string) => {
                return [value, name === 'wins' ? 'Wins' : 'Losses'];
              }}
              labelFormatter={(type) => `Contract Type: ${type}`}
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
          return (
            <div key={contract.type} className="bg-gray-750 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-white font-medium">{contract.type}</span>
                <span className={`font-bold ${
                  contract.winRate >= 60 ? 'text-green-400' : 
                  contract.winRate >= 50 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  {contract.winRate.toFixed(1)}%
                </span>
              </div>
              <div className="text-sm text-gray-400">
                {contract.wins}W / {contract.losses}L ({contract.total} total)
              </div>
              <div className="mt-2">
                <div className="w-full bg-gray-600 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      contract.winRate >= 60 ? 'bg-green-400' : 
                      contract.winRate >= 50 ? 'bg-yellow-400' : 'bg-red-400'
                    }`}
                    style={{ width: `${contract.winRate}%` }}
                  ></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TradingStats;