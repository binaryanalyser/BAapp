import React, { useState, useEffect } from 'react';
import { Activity, TrendingUp, TrendingDown, Wifi, WifiOff, Target, Brain, Zap, AlertCircle } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { derivAPI } from '../../services/derivAPI';

interface LiveTicksProps {
  symbols: string[];
}

interface TickData {
  symbol: string;
  price: number;
  epoch: number;
  pip: number;
}

interface ChartDataPoint {
  time: number;
  price: number;
  timestamp: number;
}

interface DigitStats {
  digit: number;
  count: number;
  percentage: number;
}

const LiveTicks: React.FC<LiveTicksProps> = ({ symbols }) => {
  const [selectedSymbol, setSelectedSymbol] = useState('R_10');
  const [activeTab, setActiveTab] = useState<'volatility' | 'odd-even' | 'match-differs'>('volatility');
  const [currentTick, setCurrentTick] = useState<TickData | null>(null);
  const [recentDigits, setRecentDigits] = useState<number[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [digitHistory, setDigitHistory] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { isConnected, ticks, subscribeTo, unsubscribeFrom } = useWebSocket();

  // Volatility indices configuration
  const volatilityIndices = [
    { symbol: 'R_10', label: '10', name: 'Volatility 10 Index', pip: 0.001 },
    { symbol: 'R_25', label: '25', name: 'Volatility 25 Index', pip: 0.001 },
    { symbol: 'R_50', label: '50', name: 'Volatility 50 Index', pip: 0.0001 },
    { symbol: 'R_75', label: '75', name: 'Volatility 75 Index', pip: 0.0001 },
    { symbol: 'R_100', label: '100', name: 'Volatility 100 Index', pip: 0.01 }
  ];

  // Get configuration for a symbol
  const getSymbolConfig = (symbol: string) => {
    return volatilityIndices.find(vi => vi.symbol === symbol) || volatilityIndices[0];
  };

  // Extract last digit from price
  const getLastDigit = (price: number, pip: number): number => {
    if (typeof price !== 'number' || isNaN(price)) {
      console.warn('Invalid price for digit extraction:', price);
      return 0;
    }

    try {
      // Determine decimal places based on pip
      let decimalPlaces = 0;
      if (pip === 0.01) decimalPlaces = 2;
      else if (pip === 0.001) decimalPlaces = 3;
      else if (pip === 0.0001) decimalPlaces = 4;
      else decimalPlaces = 5;

      // Format price and extract last digit
      const priceStr = price.toFixed(decimalPlaces);
      const lastChar = priceStr.slice(-1);
      const digit = parseInt(lastChar);
      
      return isNaN(digit) ? 0 : digit;
    } catch (error) {
      console.error('Error extracting digit:', error);
      return 0;
    }
  };

  // Request tick history
  const requestTickHistory = async (symbol: string) => {
    try {
      console.log('📚 Requesting tick history for', symbol);
      
      const response = await derivAPI.sendRequest({
        ticks_history: symbol,
        end: 'latest',
        start: 1,
        style: 'ticks',
        count: 100
      });

      if (response.history) {
        processTickHistory(response.history);
      }
    } catch (error) {
      console.error('Failed to fetch tick history:', error);
      setError('Failed to fetch historical data');
    }
  };

  // Process tick history data
  const processTickHistory = (history: any) => {
    if (!history.prices || !history.times) {
      console.warn('Invalid history data received');
      return;
    }

    const config = getSymbolConfig(selectedSymbol);
    const prices = history.prices.map((p: string) => parseFloat(p));
    const times = history.times;

    console.log(`📊 Processing ${prices.length} historical prices for ${selectedSymbol}`);

    // Process recent digits (last 20)
    const recentPrices = prices.slice(-20);
    const newRecentDigits = recentPrices.map(price => getLastDigit(price, config.pip));
    setRecentDigits(newRecentDigits);

    // Process digit history (last 100)
    const historyPrices = prices.slice(-100);
    const newDigitHistory = historyPrices.map(price => getLastDigit(price, config.pip));
    setDigitHistory(newDigitHistory);

    // Process chart data (last 50)
    const chartPrices = prices.slice(-50);
    const chartTimes = times.slice(-50);
    const newChartData: ChartDataPoint[] = chartPrices.map((price, index) => ({
      time: chartTimes[index] * 1000,
      price: price,
      timestamp: chartTimes[index]
    }));
    setChartData(newChartData);

    console.log('✅ History processed successfully');
    setIsLoading(false);
  };

  // Handle symbol change
  const handleSymbolChange = (symbol: string) => {
    if (symbol === selectedSymbol) return;

    console.log('🔄 Changing symbol from', selectedSymbol, 'to', symbol);
    
    // Unsubscribe from current symbol
    unsubscribeFrom(selectedSymbol);
    
    // Reset state
    setSelectedSymbol(symbol);
    setCurrentTick(null);
    setRecentDigits([]);
    setDigitHistory([]);
    setChartData([]);
    setIsLoading(true);
    setError(null);
    
    // Subscribe to new symbol
    if (isConnected) {
      subscribeTo(symbol);
      requestTickHistory(symbol);
    }
  };

  // Calculate digit statistics
  const calculateDigitStats = (): DigitStats[] => {
    if (digitHistory.length === 0) return [];

    const counts = Array(10).fill(0);
    digitHistory.forEach(digit => counts[digit]++);

    return counts.map((count, digit) => ({
      digit,
      count,
      percentage: (count / digitHistory.length) * 100
    })).sort((a, b) => b.count - a.count);
  };

  const digitStats = calculateDigitStats();

  // Get digit color based on frequency
  const getDigitColor = (digit: number, stats: DigitStats[]) => {
    const stat = stats.find(s => s.digit === digit);
    if (!stat) return 'bg-gray-600';
    
    const maxCount = Math.max(...stats.map(s => s.count));
    const minCount = Math.min(...stats.map(s => s.count));
    
    if (stat.count === maxCount) return 'bg-red-500'; // Hottest
    if (stat.count === minCount) return 'bg-blue-500'; // Coldest
    return 'bg-gray-600'; // Normal
  };

  // Handle tick updates from WebSocket context
  useEffect(() => {
    const tickData = ticks[selectedSymbol];
    if (!tickData) return;

    console.log('📊 Received tick for', selectedSymbol, ':', tickData);
    
    const config = getSymbolConfig(selectedSymbol);
    const newTickData: TickData = {
      symbol: selectedSymbol,
      price: tickData.quote,
      epoch: tickData.epoch,
      pip: config.pip
    };

    setCurrentTick(newTickData);

    // Extract last digit
    const lastDigit = getLastDigit(newTickData.price, config.pip);
    
    // Update digits arrays
    setRecentDigits(prev => {
      const newDigits = [...prev, lastDigit].slice(-20); // Keep last 20 digits
      return newDigits;
    });
    
    setDigitHistory(prev => {
      const newHistory = [...prev, lastDigit].slice(-100);
      return newHistory;
    });
    
    // Update chart data
    setChartData(prev => {
      const newPoint: ChartDataPoint = {
        time: tickData.epoch * 1000,
        price: newTickData.price,
        timestamp: tickData.epoch
      };
      return [...prev, newPoint].slice(-50); // Keep last 50 points
    });

    setIsLoading(false);
  }, [ticks[selectedSymbol], selectedSymbol]);

  // Initialize subscription
  useEffect(() => {
    if (isConnected) {
      subscribeTo(selectedSymbol);
      requestTickHistory(selectedSymbol);
    }
    
    return () => {
      unsubscribeFrom(selectedSymbol);
    };
  }, [selectedSymbol, isConnected]);

  // Get connection status display
  const getConnectionDisplay = () => {
    if (isConnected) {
      return { icon: Wifi, color: 'text-green-400', text: 'Live' };
    } else {
      return { icon: WifiOff, color: 'text-red-400', text: 'Disconnected' };
    }
  };

  const connectionDisplay = getConnectionDisplay();
  const ConnectionIcon = connectionDisplay.icon;

  // Tab configuration
  const tabs = [
    { id: 'volatility' as const, label: 'VOLATILITY INDICES' },
    { id: 'odd-even' as const, label: 'ODD/EVEN' },
    { id: 'match-differs' as const, label: 'MATCH/DIFFERS' }
  ];

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-700">
        <h3 className="text-xl font-semibold text-white">Live Ticks</h3>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-sm text-green-400 font-medium">{connectionDisplay.text}</span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-700">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-gray-700 text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white hover:bg-gray-750'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-4"></div>
              <p className="text-gray-400">Loading tick data...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Volatility Indices Selector */}
            {activeTab === 'volatility' && (
              <div className="mb-6">
                <div className="flex space-x-2">
                  {volatilityIndices.map((index) => (
                    <button
                      key={index.symbol}
                      onClick={() => handleSymbolChange(index.symbol)}
                      className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                        selectedSymbol === index.symbol
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {index.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Last Digits Display */}
            <div className="mb-6">
              <div className="flex items-center space-x-4 mb-4">
                <span className="text-gray-400 font-medium">Last Digits:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentDigits.map((digit, index) => (
                  <div
                    key={index}
                    className={`w-15 h-15 rounded-lg flex items-center justify-center text-white font-bold ${
                      getDigitColor(digit, digitStats)
                    }`}
                  >
                    {digit}
                  </div>
                ))}
              </div>
            </div>

            {/* Price Chart */}
            <div className="mb-6">
              <div className="h-32 bg-gray-750 rounded-lg p-2">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <XAxis 
                        dataKey="time" 
                        type="number" 
                        scale="time" 
                        domain={['dataMin', 'dataMax']}
                        tickFormatter={() => ''}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis 
                        domain={['dataMin - 0.001', 'dataMax + 0.001']}
                        tickFormatter={() => ''}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip 
                        formatter={(value: any) => [
                          typeof value === 'number' ? value.toFixed(4) : value, 
                          'Price'
                        ]}
                        labelFormatter={(time: any) => new Date(time).toLocaleTimeString()}
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
                    <Activity className="h-8 w-8 opacity-50" />
                  </div>
                )}
              </div>
            </div>

            {/* Digit Analysis */}
            <div className="bg-gray-750 rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-lg font-medium text-white">
                  Digit Analysis ({digitHistory.length} digits)
                </h4>
                <div className="flex items-center space-x-6">
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-red-500 rounded"></div>
                    <span className="text-sm text-red-400">Hottest Number</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-blue-500 rounded"></div>
                    <span className="text-sm text-blue-400">Coldest Number</span>
                  </div>
                </div>
              </div>

              {/* Hot/Cold Numbers */}
              {digitStats.length > 0 && (
                <div className="grid grid-cols-2 gap-8 mb-6">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-red-400 mb-2">
                      {digitStats[0].digit}
                    </div>
                    <div className="text-sm text-red-300 mb-1">Hottest Number</div>
                    <div className="text-xs text-gray-400">
                      ({digitStats[0].count} times)
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-blue-400 mb-2">
                      {digitStats[digitStats.length - 1].digit}
                    </div>
                    <div className="text-sm text-blue-300 mb-1">Coldest Number</div>
                    <div className="text-xs text-gray-400">
                      ({digitStats[digitStats.length - 1].count} times)
                    </div>
                  </div>
                </div>
              )}

              {/* Digit Frequency Bars */}
              <div className="space-y-3">
                {Array.from({ length: 10 }, (_, i) => {
                  const stat = digitStats.find(s => s.digit === i) || { digit: i, count: 0, percentage: 0 };
                  const isHottest = digitStats.length > 0 && stat.digit === digitStats[0].digit;
                  const isColdest = digitStats.length > 0 && stat.digit === digitStats[digitStats.length - 1].digit;
                  
                  return (
                    <div key={i} className="flex items-center space-x-4">
                      <span className="text-white font-medium w-4">{i}:</span>
                      <div className="flex-1 bg-gray-600 rounded-full h-4 relative overflow-hidden">
                        <div 
                          className={`h-4 rounded-full transition-all duration-500 ${
                            isHottest ? 'bg-red-500' : 
                            isColdest ? 'bg-blue-500' : 'bg-gray-500'
                          }`}
                          style={{ width: `${stat.percentage}%` }}
                        ></div>
                      </div>
                      <span className="text-white font-medium w-8 text-right">{stat.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LiveTicks;