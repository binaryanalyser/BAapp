import React from 'react';
import { History, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { useTradingContext } from '../../contexts/TradingContext';
import { useAuth } from '../../contexts/AuthContext';

const TradeHistory: React.FC = () => {
  const { trades } = useTradingContext();
  const { user } = useAuth();

  const getStatusIcon = (status: 'won' | 'lost' | 'open') => {
    switch (status) {
      case 'won':
        return <TrendingUp className="h-4 w-4 text-green-400" />;
      case 'lost':
        return <TrendingDown className="h-4 w-4 text-red-400" />;
      case 'open':
        return <Clock className="h-4 w-4 text-yellow-400" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: 'won' | 'lost' | 'open') => {
    switch (status) {
      case 'won':
        return 'text-green-400';
      case 'lost':
        return 'text-red-400';
      case 'open':
        return 'text-yellow-400';
    }
  };

  const getProfitColor = (profit: number) => {
    if (profit > 0) return 'text-green-400';
    if (profit < 0) return 'text-red-400';
    return 'text-gray-400';
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold text-white">Trade History</h3>
          {user && (
            <p className="text-sm text-gray-400 mt-1">
              {user.loginid} ({user.is_virtual ? 'Demo' : 'Real'}) - {trades.length} trades
            </p>
          )}
        </div>
        <History className="h-5 w-5 text-gray-400" />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-3 px-4 text-gray-400 font-medium">Symbol</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">Type</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">Stake</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">Payout</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">Profit</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">Status</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">Time</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((trade) => (
              <tr key={trade.id} className="border-b border-gray-700 hover:bg-gray-750">
                <td className="py-3 px-4 text-white font-medium">{trade.symbol}</td>
                <td className="py-3 px-4">
                  <span className="bg-gray-700 px-2 py-1 rounded text-xs text-gray-300">
                    {trade.type}
                  </span>
                  {trade.id.startsWith('deriv_') && (
                    <span className="ml-1 bg-blue-600 px-2 py-1 rounded text-xs text-white">
                      DERIV
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-white font-mono">${trade.stake.toFixed(2)}</td>
                <td className="py-3 px-4 text-white font-mono">${trade.payout.toFixed(2)}</td>
                <td className={`py-3 px-4 font-mono ${getProfitColor(trade.profit)}`}>
                  {trade.profit > 0 ? '+' : ''}${trade.profit.toFixed(2)}
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(trade.status)}
                    <span className={`capitalize ${getStatusColor(trade.status)}`}>
                      {trade.status}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-4 text-gray-400 text-sm">
                  <div>Entry: {new Date(trade.entryTime).toLocaleTimeString()}</div>
                  {trade.exitTime && <div>Exit: {new Date(trade.exitTime).toLocaleTimeString()}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {trades.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No trades yet</p>
        </div>
      )}
    </div>
  );
};

export default TradeHistory;