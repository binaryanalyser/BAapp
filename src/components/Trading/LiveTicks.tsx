import React, { useState, useEffect, useRef } from 'react';
import { Activity, TrendingUp, TrendingDown, Wifi, WifiOff } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';

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
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [currentTick, setCurrentTick] = useState<TickData | null>(null);
  const [recentDigits, setRecentDigits] = useState<number[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [digitHistory, setDigitHistory] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const subscriptionIdRef = useRef<string | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  // Volatility indices configuration
  const volatilityIndices = [
    { symbol: 'R_10', label: 'Vol 10', name: 'Volatility 10 Index', pip: 0.001 },
    { symbol: 'R_25', label: 'Vol 25', name: 'Volatility 25 Index', pip: 0.001 },
    { symbol: 'R_50', label: 'Vol 50', name: 'Volatility 50 Index', pip: 0.0001 },
    { symbol: 'R_75', label: 'Vol 75', name: 'Volatility 75 Index', pip: 0.0001 },
    { symbol: 'R_100', label: 'Vol 100', name: 'Volatility 100 Index', pip: 0.01 }
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
      
      console.log(`Price: ${price}, Formatted: ${priceStr}, Last digit: ${digit}`);
      return isNaN(digit) ? 0 : digit;
    } catch (error) {
      console.error('Error extracting digit:', error);
      return 0;
    }
  };

  // WebSocket connection management
  const connectWebSocket = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    setConnectionStatus('connecting');
    setError(null);
    console.log('Connecting to Deriv WebSocket...');
    
    try {
      wsRef.current = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=1089');
      
      wsRef.current.onopen = () => {
        console.log('✅ WebSocket connected successfully');
        setIsConnected(true);
        setConnectionStatus('connected');
        setError(null);
        reconnectAttemptsRef.current = 0;
        
        // Subscribe to selected symbol
        subscribeToSymbol(selectedSymbol);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setConnectionStatus('error');
        setError('Connection error occurred');
      };

      wsRef.current.onclose = (event) => {
        console.log('🔌 WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        setConnectionStatus('disconnected');
        
        // Auto-reconnect if not a clean close
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connectWebSocket();
          }, delay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          setError('Maximum reconnection attempts reached');
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionStatus('error');
      setError('Failed to establish connection');
    }
  };

  // Handle WebSocket messages
  const handleWebSocketMessage = (data: any) => {
    console.log('📨 WebSocket message:', data);

    // Handle errors
    if (data.error) {
      console.error('API Error:', data.error);
      setError(`API Error: ${data.error.message}`);
      return;
    }

    // Handle tick data
    if (data.tick && data.tick.symbol === selectedSymbol) {
      console.log('📊 Received tick for', selectedSymbol, ':', data.tick);
      
      const config = getSymbolConfig(selectedSymbol);
      const tickData: TickData = {
        symbol: data.tick.symbol,
        price: data.tick.quote,
        epoch: data.tick.epoch,
        pip: config.pip
      };

      setCurrentTick(tickData);
      
      // Store subscription ID
      if (data.subscription?.id) {
        subscriptionIdRef.current = data.subscription.id;
        console.log('💾 Stored subscription ID:', data.subscription.id);
      }

      // Extract last digit
      const lastDigit = getLastDigit(tickData.price, config.pip);
      
      // Update digits arrays
      setRecentDigits(prev => {
        const newDigits = [...prev, lastDigit].slice(-20); // Keep last 20 digits
        console.log('🔢 Updated recent digits:', newDigits);
        return newDigits;
      });
      
      setDigitHistory(prev => [...prev, lastDigit].slice(-100)); // Keep last 100 for analysis
      
      // Update chart data
      setChartData(prev => {
        const newPoint: ChartDataPoint = {
          time: data.tick.epoch * 1000,
          price: tickData.price,
          timestamp: data.tick.epoch
        };
        return [...prev, newPoint].slice(-50); // Keep last 50 points
      });

      // Request history if we don't have enough data
      if (recentDigits.length === 0) {
        requestTickHistory(selectedSymbol);
      }

      setIsLoading(false);
    }

    // Handle tick history
    if (data.history && data.echo_req?.ticks_history === selectedSymbol) {
      console.log('📈 Received history for', selectedSymbol, ':', data.history);
      processTickHistory(data.history);
    }

    // Handle subscription confirmation
    if (data.subscription) {
      console.log('✅ Subscription confirmed:', data.subscription);
      subscriptionIdRef.current = data.subscription.id;
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

  // Subscribe to a symbol
  const subscribeToSymbol = (symbol: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('Cannot subscribe: WebSocket not ready');
      return;
    }

    console.log('📡 Subscribing to', symbol);
    
    const request = {
      ticks: symbol,
      subscribe: 1,
      req_id: Date.now()
    };

    wsRef.current.send(JSON.stringify(request));
  };

  // Unsubscribe from current symbol
  const unsubscribeFromSymbol = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !subscriptionIdRef.current) {
      return;
    }

    console.log('🚫 Unsubscribing from subscription:', subscriptionIdRef.current);
    
    const request = {
      forget: subscriptionIdRef.current,
      req_id: Date.now()
    };

    wsRef.current.send(JSON.stringify(request));
    subscriptionIdRef.current = null;
  };

  // Request tick history
  const requestTickHistory = (symbol: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    console.log('📚 Requesting tick history for', symbol);
    
    const request = {
      ticks_history: symbol,
      end: 'latest',
      start: 1,
      style: 'ticks',
      count: 100,
      req_id: Date.now()
    };

    wsRef.current.send(JSON.stringify(request));
  };

  // Handle symbol change
  const handleSymbolChange = (symbol: string) => {
    if (symbol === selectedSymbol) return;

    console.log('🔄 Changing symbol from', selectedSymbol, 'to', symbol);
    
    // Unsubscribe from current symbol
    unsubscribeFromSymbol();
    
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
      setTimeout(() => subscribeToSymbol(symbol), 100);
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

  // Initialize WebSocket connection
  useEffect(() => {
    connectWebSocket();
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting');
      }
    };
  }, []);

  // Handle symbol changes
  useEffect(() => {
    if (isConnected) {
      handleSymbolChange(selectedSymbol);
    }
  }, [selectedSymbol, isConnected]);

  // Get connection status display
  const getConnectionDisplay = () => {
    switch (connectionStatus) {
      case 'connected':
        return { icon: Wifi, color: 'text-green-400', text: 'Connected' };
      case 'connecting':
        return { icon: Activity, color: 'text-yellow-400', text: 'Connecting...' };
      case 'disconnected':
        return { icon: WifiOff, color: 'text-red-400', text: 'Disconnected' };
      case 'error':
        return { icon: WifiOff, color: 'text-red-400', text: 'Error' };
      default:
        return { icon: Activity, color: 'text-gray-400', text: 'Unknown' };
    }
  };

  const connectionDisplay = getConnectionDisplay();
  const ConnectionIcon = connectionDisplay.icon;

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-white">Live Ticks Analysis</h3>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <ConnectionIcon className={`h-4 w-4 ${connectionDisplay.color} ${connectionStatus === 'connecting' ? 'animate-pulse' : ''}`} />
            <span className={`text-sm ${connectionDisplay.color}`}>
              {connectionDisplay.text}
            </span>
          </div>
          {reconnectAttemptsRef.current > 0 && (
            <span className="text-xs text-gray-400">
              ({reconnectAttemptsRef.current}/{maxReconnectAttempts})
            </span>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-500 rounded-lg">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Symbol Selector */}
      <div className="mb-6">
        <div className="flex space-x-1 bg-gray-700 rounded-lg p-1">
          {volatilityIndices.map((index) => (
            <button
              key={index.symbol}
              onClick={() => handleSymbolChange(index.symbol)}
              disabled={!isConnected}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors disabled:opacity-50 ${
                selectedSymbol === index.symbol
                  ? 'bg-gray-900 text-white border border-gray-500'
                  : 'text-gray-300 hover:text-white hover:bg-gray-600'
              }`}
            >
              {index.label}
            </button>
          ))}
        </div>
      </div>

      {/* Current Price Display */}
      {currentTick && (
        <div className="mb-6 bg-gray-750 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-lg font-semibold text-white">{getSymbolConfig(selectedSymbol).name}</h4>
              <p className="text-sm text-gray-400">Symbol: {currentTick.symbol}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-400 font-mono">
                {currentTick.price.toFixed(getSymbolConfig(selectedSymbol).pip === 0.01 ? 2 : getSymbolConfig(selectedSymbol).pip === 0.001 ? 3 : 4)}
              </div>
              <div className="text-sm text-gray-400">
                {new Date(currentTick.epoch * 1000).toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading tick data...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Last Digits Display */}
          <div className="mb-6">
            <h4 className="text-lg font-medium text-white mb-3">Last 20 Digits</h4>
            <div className="flex flex-wrap gap-2 justify-center">
              {recentDigits.map((digit, index) => {
                const isEven = digit % 2 === 0;
                const isRecent = index >= recentDigits.length - 5;
                return (
                  <div
                    key={index}
                    className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                      isRecent
                        ? isEven
                          ? 'bg-blue-500 text-white shadow-lg scale-110'
                          : 'bg-red-500 text-white shadow-lg scale-110'
                        : isEven
                        ? 'bg-blue-400 text-white'
                        : 'bg-red-400 text-white'
                    }`}
                  >
                    {digit}
                  </div>
                );
              })}
            </div>
            {recentDigits.length === 0 && (
              <div className="text-center text-gray-400 py-4">
                <p>Waiting for tick data...</p>
              </div>
            )}
          </div>

          {/* Price Chart */}
          <div className="mb-6">
            <h4 className="text-lg font-medium text-white mb-3">Price Movement</h4>
            <div className="h-48 bg-gray-750 rounded-lg p-2">
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
                  <div className="text-center">
                    <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Waiting for chart data...</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Digit Analysis */}
          {digitStats.length > 0 && (
            <div className="bg-gray-750 rounded-lg p-4">
              <h4 className="text-lg font-medium text-white mb-3">
                Digit Analysis ({digitHistory.length} samples)
              </h4>
              
              {/* Top/Bottom Digits */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center p-3 bg-red-600/20 rounded-lg border border-red-500">
                  <div className="text-xl font-bold text-red-400">
                    {digitStats[0]?.digit ?? 'N/A'}
                  </div>
                  <div className="text-sm text-red-300">Hottest Digit</div>
                  <div className="text-xs text-gray-400">
                    {digitStats[0]?.count ?? 0} times ({digitStats[0]?.percentage.toFixed(1) ?? 0}%)
                  </div>
                </div>
                <div className="text-center p-3 bg-blue-600/20 rounded-lg border border-blue-500">
                  <div className="text-xl font-bold text-blue-400">
                    {digitStats[digitStats.length - 1]?.digit ?? 'N/A'}
                  </div>
                  <div className="text-sm text-blue-300">Coldest Digit</div>
                  <div className="text-xs text-gray-400">
                    {digitStats[digitStats.length - 1]?.count ?? 0} times ({digitStats[digitStats.length - 1]?.percentage.toFixed(1) ?? 0}%)
                  </div>
                </div>
              </div>

              {/* Digit Frequency Bars */}
              <div className="space-y-2">
                {digitStats.map((stat) => (
                  <div key={stat.digit} className="flex items-center space-x-3">
                    <span className="text-sm text-gray-300 w-4">{stat.digit}:</span>
                    <div className="flex-1 bg-gray-700 rounded-full h-3">
                      <div 
                        className={`h-3 rounded-full transition-all duration-500 ${
                          stat === digitStats[0] ? 'bg-red-400' :
                          stat === digitStats[digitStats.length - 1] ? 'bg-blue-400' : 
                          'bg-gray-500'
                        }`}
                        style={{ width: `${stat.percentage}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-300 w-12">{stat.count}</span>
                    <span className="text-xs text-gray-400 w-12">{stat.percentage.toFixed(1)}%</span>
                  </div>
                ))}
              </div>

              {/* Even/Odd Analysis */}
              <div className="mt-4 pt-4 border-t border-gray-600">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-blue-400">
                      {digitHistory.filter(d => d % 2 === 0).length}
                    </div>
                    <div className="text-sm text-blue-300">Even Numbers</div>
                    <div className="text-xs text-gray-400">
                      {((digitHistory.filter(d => d % 2 === 0).length / digitHistory.length) * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-red-400">
                      {digitHistory.filter(d => d % 2 === 1).length}
                    </div>
                    <div className="text-sm text-red-300">Odd Numbers</div>
                    <div className="text-xs text-gray-400">
                      {((digitHistory.filter(d => d % 2 === 1).length / digitHistory.length) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LiveTicks;