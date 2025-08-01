import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useWebSocket } from '../../contexts/WebSocketContext';

interface TradingChartProps {
  symbol: string;
}

interface ChartData {
  time: string;
  price: number;
  timestamp: number;
}

const TradingChart: React.FC<TradingChartProps> = ({ symbol }) => {
  const { ticks } = useWebSocket();
  const [chartData, setChartData] = useState<ChartData[]>([]);

  useEffect(() => {
    const tick = ticks[symbol];
    if (tick) {
      const newDataPoint: ChartData = {
        time: new Date(tick.epoch * 1000).toLocaleTimeString(),
        price: tick.price,
        timestamp: tick.epoch
      };

      setChartData(prev => {
        const updated = [...prev, newDataPoint];
        // Keep last 50 data points
        return updated.slice(-50);
      });
    }
  }, [ticks, symbol]);

  const formatTooltip = (value: any, name: string) => {
    if (name === 'price') {
      return [`${value.toFixed(4)}`, 'Price'];
    }
    return [value, name];
  };

  return (
    <div className="h-96">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-semibold text-white">{symbol} Price Chart</h4>
        <div className="text-sm text-gray-400">
          Live: {ticks[symbol]?.price?.toFixed(4) || '---'}
        </div>
      </div>
      
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="time" 
              stroke="#9CA3AF"
              fontSize={12}
            />
            <YAxis 
              stroke="#9CA3AF"
              fontSize={12}
              domain={['dataMin - 0.001', 'dataMax + 0.001']}
              tickFormatter={(value) => value.toFixed(4)}
            />
            <Tooltip 
              formatter={formatTooltip}
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '6px',
                color: '#F9FAFB'
              }}
            />
            <Line 
              type="monotone" 
              dataKey="price" 
              stroke="#3B82F6" 
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#3B82F6' }}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-full text-gray-400">
          <div className="text-center">
            <div className="animate-pulse mb-4">
              <div className="h-4 bg-gray-700 rounded w-32 mx-auto"></div>
            </div>
            <p>Waiting for tick data...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradingChart;