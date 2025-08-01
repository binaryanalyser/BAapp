import React, { useState, useEffect, useRef } from 'react';
import { Activity, TrendingUp, TrendingDown } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { useWebSocket } from '../../contexts/WebSocketContext';

interface LiveTicksProps {
  symbols: string[];
}

interface ChartDataPoint {
  time: number;
  price: number;
  timestamp: number;
}

interface DigitData {
  digit: number;
  movement: 'up' | 'down' | 'none';
  isRecent: boolean;
}

const LiveTicks: React.FC<LiveTicksProps> = ({ symbols }) => {
  const { ticks, isConnected, subscribeTo } = useWebSocket();
  const [selectedSymbol, setSelectedSymbol] = useState('R_10');
  const [digits, setDigits] = useState<DigitData[]>(Array(20).fill({ digit: 0, movement: 'none', isRecent: false }));
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [prices, setPrices] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasReceivedData, setHasReceivedData] = useState(false);
  
  // Tab state
  const [activeCategory, setActiveCategory] = useState('volatility');
  
  // Extended digit history for analysis (up to 100+ digits)
  const [digitHistory, setDigitHistory] = useState<number[]>([]);
  const [priceHistory, setPriceHistory] = useState<number[]>([]);

  // Asset configurations based on digits.js
  const assetConfigs = {
    'R_100': { decimals: 2, label: '100' },
    'R_10': { decimals: 3, label: '10' },
    'R_25': { decimals: 3, label: '25' },
    'R_50': { decimals: 4, label: '50' },
    'R_75': { decimals: 4, label: '75' },
    'RDBEAR': { decimals: 4, label: 'Bear' },
    'RDBULL': { decimals: 4, label: 'Bull' }
  };

  const volatilityIndices = [
    { symbol: 'R_10', label: '10', name: 'Volatility 10 Index' },
    { symbol: 'R_25', label: '25', name: 'Volatility 25 Index' },
    { symbol: 'R_50', label: '50', name: 'Volatility 50 Index' },
    { symbol: 'R_75', label: '75', name: 'Volatility 75 Index' },
    { symbol: 'R_100', label: '100', name: 'Volatility 100 Index' }
  ];

  const categories = [
    { id: 'volatility', label: 'VOLATILITY INDICES' },
    { id: 'oddeven', label: 'ODD/EVEN' },
    { id: 'matchdiffers', label: 'MATCH/DIFFERS' }
  ];

  // Get decimal places for symbol (based on digits.js xd variable)
  const getDecimalPlaces = (symbol: string): number => {
    return assetConfigs[symbol as keyof typeof assetConfigs]?.decimals || 4;
  };

  // Extract last digit from price (based on digits.js logic)
  const getLastDigit = (price: number, decimals: number): number => {
    const fixedPrice = price.toFixed(decimals);
    return parseInt(fixedPrice.slice(-1));
  };

  // Determine price movement direction (based on digits.js toggleDigit logic)
  const getPriceMovement = (currentPrice: number, previousPrice: number): 'up' | 'down' | 'none' => {
    if (currentPrice > previousPrice) return 'up';
    if (currentPrice < previousPrice) return 'down';
    return 'none';
  };

  // Subscribe to selected symbol when it changes or when connected
  useEffect(() => {
    if (isConnected) {
      console.log('Subscribing to', selectedSymbol);
      subscribeTo(selectedSymbol);
    }
  }, [selectedSymbol, isConnected, subscribeTo]);

  // Process tick data from context (based on digits.js ws.onmessage logic)
  useEffect(() => {
    const tick = ticks[selectedSymbol];
    if (tick) {
      console.log('Received tick for', selectedSymbol, ':', tick.tick);
      
      const decimals = getDecimalPlaces(selectedSymbol);
      const currentPrice = tick.tick;
      const newDigit = getLastDigit(currentPrice, decimals);
      
      setHasReceivedData(true);
      setIsLoading(false);
      
      // Update price history
      setPriceHistory(prev => {
        const newHistory = [...prev, currentPrice];
        return newHistory.slice(-21); // Keep last 21 prices (current + 20 previous)
      });
      
      // Update digit history
      setDigitHistory(prev => [...prev, newDigit].slice(-100));
      
      // Update digits array with movement detection (based on digits.js logic)
      setDigits(prev => {
        const newDigits = [...prev];
        
        // Shift all digits left and add new digit at the end
        for (let i = 0; i < newDigits.length - 1; i++) {
          newDigits[i] = {
            ...newDigits[i + 1],
            isRecent: false
          };
        }
        
        // Determine movement for new digit
        let movement: 'up' | 'down' | 'none' = 'none';
        if (priceHistory.length > 0) {
          const previousPrice = priceHistory[priceHistory.length - 1];
          movement = getPriceMovement(currentPrice, previousPrice);
        }
        
        // Add new digit
        newDigits[newDigits.length - 1] = {
          digit: newDigit,
          movement,
          isRecent: true
        };
        
        return newDigits;
      });
      
      // Update chart data
      setChartData(prev => [...prev.slice(-19), {
        time: tick.epoch * 1000,
        price: tick.tick,
        timestamp: tick.epoch
      }]);
      
      // Update prices for display
      setPrices(prev => [...prev.slice(-19), tick.tick]);
    }
  }, [ticks, selectedSymbol, priceHistory]);

  const handleSymbolChange = (symbol: string) => {
    console.log('Changing symbol to:', symbol);
    setSelectedSymbol(symbol);
    // Reset data when changing symbols
    setDigits(Array(20).fill({ digit: 0, movement: 'none', isRecent: false }));
    setDigitHistory([]);
    setPriceHistory([]);
    setChartData([]);
    setPrices([]);
    setHasReceivedData(false);
    setIsLoading(true);
  };

  // Get digit styling based on value and movement (based on digits.js CSS classes)
  const getDigitStyling = (digitData: DigitData, index: number) => {
    const { digit, movement, isRecent } = digitData;
    const isEven = digit % 2 === 0;
    const isLast5 = index >= 15; // Last 5 digits are more prominent
    
    let baseClass = 'w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold transition-all duration-300 ';
    
    // Color based on even/odd
    if (isLast5 || isRecent) {
      baseClass += isEven ? 'bg-blue-500 text-white shadow-lg ' : 'bg-red-500 text-white shadow-lg ';
    } else {
      baseClass += isEven ? 'bg-blue-400 text-white ' : 'bg-red-400 text-white ';
    }
    
    // Movement animation classes (based on digits.js digits_moved_up/down)
    if (movement === 'up') {
      baseClass += 'animate-bounce border-2 border-green-400 ';
    } else if (movement === 'down') {
      baseClass += 'animate-bounce border-2 border-red-400 ';
    }
    
    return baseClass;
  };

  // Digit analysis functions (enhanced from original logic)
  const analyzeDigits = () => {
    if (digitHistory.length === 0) return null;
    
    const digitCounts = Array(10).fill(0);
    digitHistory.forEach(digit => digitCounts[digit]++);
    
    const maxCount = Math.max(...digitCounts);
    const minCount = Math.min(...digitCounts);
    
    const hottestNumbers = digitCounts
      .map((count, digit) => ({ digit, count }))
      .filter(item => item.count === maxCount)
      .map(item => item.digit);
    
    const coldestNumbers = digitCounts
      .map((count, digit) => ({ digit, count }))
      .filter(item => item.count === minCount)
      .map(item => item.digit);
    
    const evenCount = digitHistory.filter(d => d % 2 === 0).length;
    const oddCount = digitHistory.filter(d => d % 2 === 1).length;
    
    return {
      hottestNumbers,
      coldestNumbers,
      hottestCount: maxCount,
      coldestCount: minCount,
      evenCount,
      oddCount,
      totalCount: digitHistory.length,
      digitCounts
    };
  };

  const analysis = analyzeDigits();
  const currentPrice = ticks[selectedSymbol]?.tick || 0;

  // Get content based on active category
  const getCategoryContent = () => {
    switch (activeCategory) {
      case 'volatility':
        return (
          <div className="flex space-x-1 mb-6 bg-gray-700 rounded-lg p-1">
            {volatilityIndices.map((index) => (
              <button
                key={index.symbol}
                onClick={() => handleSymbolChange(index.symbol)}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  selectedSymbol === index.symbol
                    ? 'bg-gray-900 text-white border border-gray-500'
                    : 'text-gray-300 hover:text-white hover:bg-gray-600'
                }`}
              >
                {index.label}
              </button>
            ))}
          </div>
        );
      
      case 'oddeven':
        return (
          <div className="mb-6">
            <div className="bg-gray-700 rounded-lg p-4 mb-4">
              <h4 className="text-white font-medium mb-3">Odd/Even Analysis</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-blue-600/20 rounded-lg border border-blue-500">
                  <div className="text-2xl font-bold text-blue-400">
                    {analysis ? analysis.evenCount : 0}
                  </div>
                  <div className="text-sm text-blue-300">Even Numbers</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {analysis ? ((analysis.evenCount / analysis.totalCount) * 100).toFixed(1) : 0}%
                  </div>
                </div>
                <div className="text-center p-4 bg-red-600/20 rounded-lg border border-red-500">
                  <div className="text-2xl font-bold text-red-400">
                    {analysis ? analysis.oddCount : 0}
                  </div>
                  <div className="text-sm text-red-300">Odd Numbers</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {analysis ? ((analysis.oddCount / analysis.totalCount) * 100).toFixed(1) : 0}%
                  </div>
                </div>
              </div>
              
              {/* Prediction based on imbalance */}
              {analysis && (
                <div className="mt-4 p-3 bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">Next Prediction:</span>
                    <div className="flex items-center space-x-2">
                      <span className={`font-bold ${
                        analysis.evenCount > analysis.oddCount ? 'text-red-400' : 'text-blue-400'
                      }`}>
                        {analysis.evenCount > analysis.oddCount ? 'ODD' : 'EVEN'}
                      </span>
                      <span className="text-xs text-gray-400">
                        ({Math.abs(analysis.evenCount - analysis.oddCount)} difference)
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      
      case 'matchdiffers':
        return (
          <div className="mb-6">
            <div className="bg-gray-700 rounded-lg p-4 mb-4">
              <h4 className="text-white font-medium mb-3">Match/Differs Analysis</h4>
              
              {/* Digit frequency display */}
              <div className="mb-4">
                <label className="block text-sm text-gray-300 mb-2">Digit Frequency:</label>
                <div className="grid grid-cols-5 gap-2">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(digit => {
                    const count = analysis ? analysis.digitCounts[digit] : 0;
                    const percentage = analysis ? ((count / analysis.totalCount) * 100).toFixed(1) : '0';
                    const isHottest = analysis && analysis.hottestNumbers.includes(digit);
                    const isColdest = analysis && analysis.coldestNumbers.includes(digit);
                    
                    return (
                      <div key={digit} className={`text-center p-2 rounded border ${
                        isHottest ? 'bg-red-600/20 border-red-500' :
                        isColdest ? 'bg-blue-600/20 border-blue-500' :
                        'bg-gray-800 border-gray-600'
                      }`}>
                        <div className="text-lg font-bold text-white">{digit}</div>
                        <div className="text-xs text-gray-400">{count}x</div>
                        <div className="text-xs text-gray-500">{percentage}%</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Match/Differs prediction */}
              {analysis && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-green-600/20 rounded-lg border border-green-500">
                    <div className="text-xl font-bold text-green-400">MATCH</div>
                    <div className="text-sm text-green-300">
                      Hottest: {analysis.hottestNumbers.join(', ')}
                    </div>
                    <div className="text-xs text-gray-400">
                      {analysis.hottestCount} occurrences
                    </div>
                  </div>
                  <div className="text-center p-4 bg-yellow-600/20 rounded-lg border border-yellow-500">
                    <div className="text-xl font-bold text-yellow-400">DIFFERS</div>
                    <div className="text-sm text-yellow-300">
                      Coldest: {analysis.coldestNumbers.join(', ')}
                    </div>
                    <div className="text-xs text-gray-400">
                      {analysis.coldestCount} occurrences
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-white">Live Ticks</h3>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'
          }`}></div>
          <span className="text-sm text-gray-400">
            {isConnected ? 'Live' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex space-x-1 mb-4 bg-gray-700 rounded-lg p-1">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
              activeCategory === category.id
                ? 'bg-gray-900 text-white border border-gray-500'
                : 'text-gray-400 hover:text-white hover:bg-gray-600'
            }`}
          >
            {category.label}
          </button>
        ))}
      </div>

      {/* Category Content */}
      {getCategoryContent()}

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
          <span className="ml-3 text-gray-400">
            {!isConnected ? 'Connecting to market data...' : 'Loading tick data...'}
          </span>
        </div>
      ) : (
        <>
          {/* Current Price Display */}
          <div className="mb-4 text-center">
            <div className="text-2xl font-bold text-white font-mono">
              {currentPrice ? currentPrice.toFixed(getDecimalPlaces(selectedSymbol)) : '---'}
            </div>
            <div className="text-sm text-gray-400">{selectedSymbol} Current Price</div>
          </div>

          {/* Horizontal Digit Display (based on digits.js #digits) */}
          <div className="mb-6">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <span className="text-sm text-gray-400">Last Digits:</span>
              <div className="flex space-x-1 overflow-x-auto">
                {hasReceivedData && digits.map((digitData, index) => (
                  <div
                    key={index}
                    className={getDigitStyling(digitData, index)}
                  >
                    {digitData.digit}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Mini Chart (based on digits.js CanvasJS chart) */}
          <div className="h-32 mb-4 bg-gray-750 rounded-lg p-2">
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
                    formatter={(value: any) => [value.toFixed(getDecimalPlaces(selectedSymbol)), 'Price']}
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
                <div className="text-center">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Waiting for chart data...</p>
                </div>
              </div>
            )}
          </div>

          {/* Digit Analysis */}
          {analysis && (
            <div className="mb-4 bg-gray-750 rounded-lg p-4">
              <h5 className="text-sm font-medium text-white mb-3">Digit Analysis ({analysis.totalCount} digits)</h5>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-lg font-bold text-red-400">
                    {analysis.hottestNumbers.join(', ')}
                  </div>
                  <div className="text-xs text-gray-400">Hottest Number{analysis.hottestNumbers.length > 1 ? 's' : ''}</div>
                  <div className="text-xs text-red-300">({analysis.hottestCount} times)</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-400">
                    {analysis.coldestNumbers.join(', ')}
                  </div>
                  <div className="text-xs text-gray-400">Coldest Number{analysis.coldestNumbers.length > 1 ? 's' : ''}</div>
                  <div className="text-xs text-blue-300">({analysis.coldestCount} times)</div>
                </div>
              </div>
              
              {/* Digit frequency bars */}
              <div className="space-y-1">
                {analysis.digitCounts.map((count, digit) => (
                  <div key={digit} className="flex items-center space-x-2">
                    <span className="text-xs text-gray-400 w-4">{digit}:</span>
                    <div className="flex-1 bg-gray-700 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          count === analysis.hottestCount ? 'bg-red-400' :
                          count === analysis.coldestCount ? 'bg-blue-400' : 'bg-gray-500'
                        }`}
                        style={{ width: `${(count / Math.max(...analysis.digitCounts)) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-300 w-6">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LiveTicks;