import React, { useState, useEffect, useRef } from 'react';
import { Activity, TrendingUp, TrendingDown } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';

interface LiveTicksProps {
  symbols: string[];
}

interface TickData {
  id: string;
  symbol: string;
  price: number;
  epoch: number;
  quote: number;
}

interface HistoryData {
  times: number[];
  prices: number[];
}

interface ChartDataPoint {
  time: number;
  price: number;
  timestamp: number;
}

const LiveTicks: React.FC<LiveTicksProps> = ({ symbols }) => {
  const [selectedSymbol, setSelectedSymbol] = useState('R_10');
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [currentTick, setCurrentTick] = useState<TickData | null>(null);
  const [digits, setDigits] = useState<number[]>(Array(20).fill(0));
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [prices, setPrices] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [hasReceivedData, setHasReceivedData] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  // Tab state
  const [activeCategory, setActiveCategory] = useState('volatility');
  
  const subscriptionIdRef = useRef<string | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Extended digit history for analysis (up to 100+ digits)
  const [digitHistory, setDigitHistory] = useState<number[]>([]);

  const volatilityIndices = [
    { symbol: 'R_10', label: '10', name: 'Volatility 10', decimals: 3 },
    { symbol: 'R_25', label: '25', name: 'Volatility 25', decimals: 3 },
    { symbol: 'R_50', label: '50', name: 'Volatility 50', decimals: 4 },
    { symbol: 'R_75', label: '75', name: 'Volatility 75', decimals: 4 },
    { symbol: 'R_100', label: '100', name: 'Volatility 100', decimals: 2 }
  ];

  const categories = [
    { id: 'volatility', label: 'VOLATILITY INDICES' },
    { id: 'oddeven', label: 'ODD/EVEN' },
    { id: 'matchdiffers', label: 'MATCH/DIFFERS' }
  ];

  const getDecimalPlaces = (symbol: string) => {
    const index = volatilityIndices.find(vi => vi.symbol === symbol);
    return index?.decimals || 4;
  };

  const getLastDigit = (price: number, decimals: number) => {
    const fixedPrice = price.toFixed(decimals);
    return parseInt(fixedPrice.slice(-1));
  };

  const connectWebSocket = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setConnectionStatus('connecting');
    console.log('Connecting to WebSocket...');
    
    wsRef.current = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089&l=EN');
    
    wsRef.current.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setConnectionStatus('connected');
      setReconnectAttempts(0);
      subscribeTo(selectedSymbol);
    };

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('WebSocket message:', data);
      
      if (data.tick && data.echo_req?.ticks === selectedSymbol) {
        console.log('Received tick for', selectedSymbol, ':', data.tick.quote);
        const tickData: TickData = {
          id: data.tick.id,
          symbol: data.tick.symbol,
          price: data.tick.quote,
          epoch: data.tick.epoch,
          quote: data.tick.quote
        };
        
        setCurrentTick(tickData);
        subscriptionIdRef.current = data.tick.id;
        
        // Request tick history only once when we first get a tick
        if (prices.length === 0) {
          console.log('Requesting tick history for', selectedSymbol);
          wsRef.current?.send(JSON.stringify({
            ticks_history: selectedSymbol,
            end: 'latest',
            start: 1,
            style: 'ticks',
            count: 101,
            req_id: Math.floor(Math.random() * 1000000)
          }));
        }
        
        // Update live data immediately
        const decimals = getDecimalPlaces(selectedSymbol);
        const newDigit = getLastDigit(data.tick.quote, decimals);
        
        setHasReceivedData(true);
        setDigits(prev => [...prev.slice(1), newDigit]);
        setDigitHistory(prev => [...prev, newDigit].slice(-100)); // Keep last 100 digits
        setPrices(prev => [...prev.slice(-19), data.tick.quote]);
        setChartData(prev => [...prev.slice(-19), {
          time: data.tick.epoch * 1000,
          price: data.tick.quote,
          timestamp: data.tick.epoch
        }]);
      }

      if (data.history && data.echo_req?.ticks_history === selectedSymbol) {
        console.log('Received history for', selectedSymbol, ':', data.history);
        const history: HistoryData = data.history;
        const decimals = getDecimalPlaces(selectedSymbol);
        
        // Process history data
        const newPrices: number[] = [];
        const newDigits: number[] = [];
        const newDigitHistory: number[] = [];
        const newChartData: ChartDataPoint[] = [];
        
        const displayLength = Math.min(20, history.prices.length);
        const historyLength = Math.min(100, history.prices.length);
        
        // Process full history for analysis
        for (let i = 0; i < historyLength; i++) {
          const price = parseFloat(history.prices[history.prices.length - historyLength + i]);
          newDigitHistory.push(getLastDigit(price, decimals));
        }
        
        // Process recent data for display
        for (let i = 0; i < displayLength; i++) {
          const price = parseFloat(history.prices[history.prices.length - displayLength + i]);
          const time = history.times[history.times.length - displayLength + i];
          
          newPrices.push(price);
          newDigits.push(getLastDigit(price, decimals));
          newChartData.push({
            time: time * 1000,
            price: price,
            timestamp: time
          });
        }
        
        setPrices(newPrices);
        setDigits(newDigits);
        setDigitHistory(newDigitHistory);
        setChartData(newChartData);
        setHasReceivedData(true);
        setIsLoading(false);
        console.log('History processed, loading complete');
      }

      // Handle subscription confirmation
      if (data.subscription && data.subscription.id) {
        console.log('Subscription confirmed:', data.subscription.id);
        subscriptionIdRef.current = data.subscription.id;
      }

      // Handle errors
      if (data.error) {
        console.error('WebSocket error:', data.error);
        if (data.error.code === 'InvalidSymbol') {
          console.log('Invalid symbol, trying alternative...');
          // Try with frx prefix for some symbols
          const altSymbol = selectedSymbol.startsWith('frx') ? selectedSymbol.slice(3) : `frx${selectedSymbol}`;
          setTimeout(() => subscribeTo(altSymbol), 1000);
        }
      }
    };

    wsRef.current.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      setIsConnected(false);
      setConnectionStatus('disconnected');
      
      // Reconnect with exponential backoff
      if (reconnectAttempts < 5) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1})`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          setReconnectAttempts(prev => prev + 1);
          connectWebSocket();
        }, delay);
      }
    };

    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
      setConnectionStatus('disconnected');
    };
  };

  const subscribeTo = (symbol: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // Unsubscribe from previous symbol
      if (subscriptionIdRef.current) {
        console.log('Unsubscribing from previous symbol');
        wsRef.current?.send(JSON.stringify({
          forget: subscriptionIdRef.current
        }));
      }
      
      // Subscribe to new symbol
      console.log('Subscribing to', symbol);
      wsRef.current.send(JSON.stringify({
        ticks: symbol,
        subscribe: 1,
        req_id: Math.floor(Math.random() * 1000000)
      }));
    } else {
      console.log('WebSocket not ready, cannot subscribe to', symbol);
    }
  };

  useEffect(() => {
    connectWebSocket();
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (isConnected) {
      setIsLoading(true);
      setHasReceivedData(false);
      setDigits([]);
      setDigitHistory([]);
      setChartData([]);
      setPrices([]);
      setCurrentTick(null);
      subscribeTo(selectedSymbol);
    }
  }, [selectedSymbol, isConnected]);

  const handleSymbolChange = (symbol: string) => {
    console.log('Changing symbol to:', symbol);
    setSelectedSymbol(symbol);
  };

  const getDigitColor = (digit: number, index: number) => {
    const isEven = digit % 2 === 0;
    const isRecent = index >= 15; // Last 5 digits are more prominent
    
    if (isRecent) {
      return isEven ? 'bg-blue-500 text-white shadow-lg' : 'bg-red-500 text-white shadow-lg';
    } else {
      return isEven ? 'bg-blue-400 text-white' : 'bg-red-400 text-white';
    }
  };

  const getPriceMovement = (index: number) => {
    if (index === 0 || prices.length < 2) return 'none';
    const current = prices[index];
    const previous = prices[index - 1];
    
    if (current > previous) return 'up';
    if (current < previous) return 'down';
    return 'none';
  };

  // Digit analysis functions
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

  const getMovementClass = (movement: string) => {
    switch (movement) {
      case 'up':
        return 'border-2 border-green-400';
      case 'down':
        return 'border-2 border-red-400';
      default:
        return '';
    }
  };

  const currentPrice = currentTick?.price || 0;
  const decimals = getDecimalPlaces(selectedSymbol);
  const currentDigit = currentPrice ? getLastDigit(currentPrice, decimals) : 0;
  
  // Get content based on active category
  const getCategoryContent = () => {
    switch (activeCategory) {
      case 'volatility':
        return (
          <div className="flex space-x-1 mb-6 bg-gray-700 rounded-lg p-1">
            {volatilityIndices.map((index) => (
              <button
                key={index.symbol}
                onClick={() => setSelectedSymbol(index.symbol)}
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
              
              {/* Prediction */}
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
              
              {/* Digit Selection */}
              <div className="mb-4">
                <label className="block text-sm text-gray-300 mb-2">Select Target Digit:</label>
                <div className="grid grid-cols-5 gap-2">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(digit => {
                    const count = analysis ? analysis.digitCounts[digit] : 0;
                    const percentage = analysis ? ((count / analysis.totalCount) * 100).toFixed(1) : '0';
                    return (
                      <div key={digit} className="text-center p-2 bg-gray-800 rounded border border-gray-600">
                        <div className="text-lg font-bold text-white">{digit}</div>
                        <div className="text-xs text-gray-400">{count}x</div>
                        <div className="text-xs text-gray-500">{percentage}%</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Match/Differs Prediction */}
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
            connectionStatus === 'connected' ? 'bg-green-400 animate-pulse' : 
            connectionStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' : 
            'bg-red-400'
          }`}></div>
          <span className="text-sm text-gray-400">
            {connectionStatus === 'connected' ? 'Live' : 
             connectionStatus === 'connecting' ? 'Connecting...' : 
             `Disconnected ${reconnectAttempts > 0 ? `(${reconnectAttempts}/5)` : ''}`}
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
            {connectionStatus === 'connecting' ? 'Connecting to market data...' : 'Loading tick data...'}
          </span>
        </div>
      ) : (
        <>
          {/* Horizontal Tick Display */}
          <div className="mb-6">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <span className="text-sm text-gray-400">Last Digits:</span>
              <div className="flex space-x-1 overflow-x-auto">
                {hasReceivedData && digits.map((digit, index) => {
                  const movement = getPriceMovement(index);
                  return (
                    <div
                      key={index}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold transition-all duration-300 ${getDigitColor(digit, index)} ${getMovementClass(movement)}`}
                    >
                      {digit}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Mini Chart */}
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
                    formatter={(value: any) => [value.toFixed(decimals), 'Price']}
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
          <div className="bg-gray-750 rounded-lg p-3">
            <div className="text-lg font-bold text-blue-400">
              {analysis ? analysis.evenCount : digits.filter(d => d % 2 === 0).length}
            </div>
            <div className="text-xs text-gray-400">Even</div>
          </div>
        </>
      )}
    </div>
  );
};

export default LiveTicks;