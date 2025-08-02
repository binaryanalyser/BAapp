import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTradingContext } from '../../contexts/TradingContext';

const PerformanceChart: React.FC = () => {
  const { trades, stats } = useTradingContext();

  // Generate cumulative profit data from actual trades
  const generateChartData = () => {
    const completedTrades = trades
      .filter(trade => trade.status !== 'open' && trade.exitTime)
      .sort((a, b) => a.exitTime! - b.exitTime!);

    if (completedTrades.length === 0) {
      // Return sample data if no trades
      return [
        { date: new Date().toLocaleDateString(), profit: 0, trades: 0 }
      ];
    }

    let cumulativeProfit = 0;
    const data: Array<{ date: string; profit: number; trades: number }> = [];
    
    // Group trades by day
    const tradesByDay = new Map<string, typeof completedTrades>();
    
    completedTrades.forEach(trade => {
      const date = new Date(trade.exitTime!).toLocaleDateString();
      if (!tradesByDay.has(date)) {
        tradesByDay.set(date, []);
      }
      tradesByDay.get(date)!.push(trade);
    });

    // Calculate cumulative profit by day
    Array.from(tradesByDay.entries())
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
      .forEach(([date, dayTrades]) => {
        const dayProfit = dayTrades.reduce((sum, trade) => sum + trade.profit, 0);
        cumulativeProfit += dayProfit;
        
        data.push({
          date: date,
          profit: cumulativeProfit,
          trades: dayTrades.length
        });
      });

    return data;
  };

  const data = generateChartData();
  const totalProfit = stats.totalProfit;
  const totalTrades = stats.totalTrades;
  const avgDaily = totalTrades > 0 ? totalProfit / Math.max(data.length, 1) : 0;

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
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              stroke="#9CA3AF"
              fontSize={12}
              tickFormatter={(value) => `$${value}`}
              domain={['dataMin - 10', 'dataMax + 10']}
            />
            <Tooltip 
              formatter={(value: any, name: string) => {
                if (name === 'profit') return [`$${value.toFixed(2)}`, 'Cumulative Profit'];
                if (name === 'trades') return [value, 'Trades This Day'];
                return [value, name];
              }}
              labelFormatter={(date) => `Date: ${date}`}
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
              stroke={totalProfit >= 0 ? "#10B981" : "#EF4444"}
              strokeWidth={3}
              dot={{ fill: totalProfit >= 0 ? '#10B981' : '#EF4444', r: 4 }}
              activeDot={{ r: 6, fill: totalProfit >= 0 ? '#10B981' : '#EF4444' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4 text-center">
        <div>
          <div className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            ${totalProfit.toFixed(2)}
          </div>
          <div className="text-sm text-gray-400">Total Profit</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-blue-400">{totalTrades}</div>
          <div className="text-sm text-gray-400">Total Trades</div>
        </div>
        <div>
          <div className={`text-2xl font-bold ${avgDaily >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>
            ${avgDaily.toFixed(2)}
          </div>
          <div className="text-sm text-gray-400">Avg. Per Day</div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceChart;