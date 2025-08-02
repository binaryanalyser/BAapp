import React, { useState, useEffect } from 'react';
import { Activity, TrendingUp, TrendingDown, Wifi, WifiOff, Target } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'matches' | 'odd-even' | 'over-under'>('matches');
  const [currentTick, setCurrentTick] = useState<TickData | null>(null);
  const [recentDigits, setRecentDigits] = useState<number[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [digitHistory, setDigitHistory] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matchesHistory, setMatchesHistory] = useState<{ digit: number; matched: boolean; timestamp: number }[]>([]);
  const [differsHistory, setDiffersHistory] = useState<{ digit: number; differed: boolean; timestamp: number }[]>([]);
  
  const { isConnected, ticks, subscribeTo, unsubscribeFrom } = useWebSocket();

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
    setMatchesHistory([]);
    setDiffersHistory([]);
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

  // Calculate matches/differs statistics
  const calculateMatchesStats = () => {
    if (matchesHistory.length === 0) return { matches: 0, total: 0, percentage: 0 };
    
    const matches = matchesHistory.filter(item => item.matched).length;
    const total = matchesHistory.length;
    const percentage = (matches / total) * 100;
    
    return { matches, total, percentage };
  };

  const calculateDiffersStats = () => {
    if (differsHistory.length === 0) return { differs: 0, total: 0, percentage: 0 };
    
    const differs = differsHistory.filter(item => item.differed).length;
    const total = differsHistory.length;
    const percentage = (differs / total) * 100;
    
    return { differs, total, percentage };
  };

  const calculateOddEvenStats = () => {
    if (digitHistory.length === 0) return { odd: 0, even: 0, total: 0, oddPercentage: 0, evenPercentage: 0 };
    
    const odd = digitHistory.filter(d => d % 2 === 1).length;
    const even = digitHistory.filter(d => d % 2 === 0).length;
    const total = digitHistory.length;
    const oddPercentage = (odd / total) * 100;
    const evenPercentage = (even / total) * 100;
    
    return { odd, even, total, oddPercentage, evenPercentage };
  };

  const matchesStats = calculateMatchesStats();
  const differsStats = calculateDiffersStats();
  const oddEvenStats = calculateOddEvenStats();

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
      console.log('🔢 Updated recent digits:', newDigits);
      return newDigits;
    });
    
    setDigitHistory(prev => {
      const newHistory = [...prev, lastDigit].slice(-100);
      
      // Update matches/differs history
      const previousDigit = prev[prev.length - 1];
      if (previousDigit !== undefined) {
        const matched = lastDigit === previousDigit;
        const differed = lastDigit !== previousDigit;
        
        setMatchesHistory(prevMatches => [...prevMatches, {
          digit: lastDigit,
          matched,
          timestamp: tickData.epoch
        }].slice(-50));
        
        setDiffersHistory(prevDiffers => [...prevDiffers, {
          digit: lastDigit,
          differed,
          timestamp: tickData.epoch
        }].slice(-50));
      }
      
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
      return { icon: Wifi, color: 'text-green-400', text: 'Connected' };
    } else {
      return { icon: WifiOff, color: 'text-red-400', text: 'Disconnected' };
    }
  };

  const connectionDisplay = getConnectionDisplay();
  const ConnectionIcon = connectionDisplay.icon;

  // Tab configuration
  const tabs = [
    { id: 'matches' as const, label: 'Matches/Differs', icon: Target },
    { id: 'odd-even' as const, label: 'Odd/Even Analysis', icon: TrendingUp },
    { id: 'over-under' as const, label: 'Over/Under', icon: Activity }
  ];

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'matches':
        return renderMatchesTab();
      case 'odd-even':
        return renderOddEvenTab();
      case 'over-under':
        return renderOverUnderTab();
      default:
        return renderMatchesTab();
    }
  };

  const renderOverUnderTab = () => {
    // Calculate over/under statistics (using 5 as the threshold)
    const calculateOverUnderStats = () => {
      if (digitHistory.length === 0) return { over: 0, under: 0, equal: 0, total: 0, overPercentage: 0, underPercentage: 0, equalPercentage: 0 };
      
      const over = digitHistory.filter(d => d > 5).length;
      const under = digitHistory.filter(d => d < 5).length;
      const equal = digitHistory.filter(d => d === 5).length;
      const total = digitHistory.length;
      const overPercentage = (over / total) * 100;
      const underPercentage = (under / total) * 100;
      const equalPercentage = (equal / total) * 100;
      
      return { over, under, equal, total, overPercentage, underPercentage, equalPercentage };
    };

    const overUnderStats = calculateOverUnderStats();

    return (
    <>
      {/* Last Digits Display */}
      <div className="mb-6">
        <h4 className="text-lg font-medium text-white mb-3">Last 20 Digits</h4>
        <div className="flex flex-wrap gap-2 justify-center">
          {recentDigits.map((digit, index) => {
            const isOver = digit > 5;
            const isUnder = digit < 5;
            const isEqual = digit === 5;
            const isRecent = index >= recentDigits.length - 5;
            return (
              <div
                key={index}
                className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                  isRecent
                    ? isOver
                      ? 'bg-green-500 text-white shadow-lg scale-110'
                      : isUnder
                      ? 'bg-red-500 text-white shadow-lg scale-110'
                      : 'bg-yellow-500 text-white shadow-lg scale-110'
                    : isOver
                    ? 'bg-green-400 text-white'
                    : isUnder
                    ? 'bg-red-400 text-white'
                    : 'bg-yellow-400 text-white'
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

      {/* Over/Under Analysis */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-green-600/20 rounded-lg border border-green-500 p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">
              {overUnderStats.over}
            </div>
            <div className="text-sm text-green-300 mb-1">Over 5</div>
            <div className="text-xs text-gray-400">
              {overUnderStats.overPercentage.toFixed(1)}% of {overUnderStats.total} digits
            </div>
            <div className="text-xs text-green-200 mt-2">
              6, 7, 8, 9
            </div>
          </div>
        </div>
        <div className="bg-yellow-600/20 rounded-lg border border-yellow-500 p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400">
              {overUnderStats.equal}
            </div>
            <div className="text-sm text-yellow-300 mb-1">Equal 5</div>
            <div className="text-xs text-gray-400">
              {overUnderStats.equalPercentage.toFixed(1)}% of {overUnderStats.total} digits
            </div>
            <div className="text-xs text-yellow-200 mt-2">
              5
            </div>
          </div>
        </div>
        <div className="bg-red-600/20 rounded-lg border border-red-500 p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-400">
              {overUnderStats.under}
            </div>
            <div className="text-sm text-red-300 mb-1">Under 5</div>
            <div className="text-xs text-gray-400">
              {overUnderStats.underPercentage.toFixed(1)}% of {overUnderStats.total} digits
            </div>
            <div className="text-xs text-red-200 mt-2">
              0, 1, 2, 3, 4
            </div>
          </div>
        </div>
      </div>

      {/* Digit Analysis */}
      {digitStats.length > 0 && (
        <div className="bg-gray-750 rounded-lg p-4">
          <h4 className="text-lg font-medium text-white mb-3">
            Digit Analysis ({digitHistory.length} samples)
          </h4>
          
          {/* Digit Frequency Bars */}
          <div className="space-y-2">
            {digitStats.map((stat) => (
              <div key={stat.digit} className="flex items-center space-x-3">
                <span className="text-sm text-gray-300 w-4">{stat.digit}:</span>
                <div className="flex-1 bg-gray-700 rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full transition-all duration-500 ${
                      stat.digit > 5 ? 'bg-green-400' :
                      stat.digit < 5 ? 'bg-red-400' : 
                      'bg-yellow-400'
                    }`}
                    style={{ width: `${stat.percentage}%` }}
                  ></div>
                </div>
                <span className="text-sm text-gray-300 w-12">{stat.count}</span>
                <span className="text-xs text-gray-400 w-12">{stat.percentage.toFixed(1)}%</span>
              </div>
            ))}
          </div>

          {/* Over/Under Distribution */}
          <div className="mt-6 pt-4 border-t border-gray-600">
            <h5 className="text-md font-medium text-white mb-3">Over/Under Distribution</h5>
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Distribution:</span>
              <div className="flex items-center space-x-2">
                <div className="w-32 bg-gray-700 rounded-full h-3 flex overflow-hidden">
                  <div 
                    className="bg-red-400 transition-all duration-500"
                    style={{ width: `${overUnderStats.underPercentage}%` }}
                  ></div>
                  <div 
                    className="bg-yellow-400 transition-all duration-500"
                    style={{ width: `${overUnderStats.equalPercentage}%` }}
                  ></div>
                  <div 
                    className="bg-green-400 transition-all duration-500"
                    style={{ width: `${overUnderStats.overPercentage}%` }}
                  ></div>
                </div>
                <span className="text-xs text-gray-400">
                  U:{overUnderStats.underPercentage.toFixed(1)}% | E:{overUnderStats.equalPercentage.toFixed(1)}% | O:{overUnderStats.overPercentage.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
    );
  };

  const renderMatchesTab = () => (
    <div className="space-y-6">
      {/* Matches/Differs Overview */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-green-600/20 rounded-lg border border-green-500 p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">
              {matchesStats.matches}
            </div>
            <div className="text-sm text-green-300 mb-1">Matches</div>
            <div className="text-xs text-gray-400">
              {matchesStats.percentage.toFixed(1)}% of {matchesStats.total} ticks
            </div>
          </div>
        </div>
        <div className="bg-red-600/20 rounded-lg border border-red-500 p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-400">
              {differsStats.differs}
            </div>
            <div className="text-sm text-red-300 mb-1">Differs</div>
            <div className="text-xs text-gray-400">
              {differsStats.percentage.toFixed(1)}% of {differsStats.total} ticks
            </div>
          </div>
        </div>
      </div>

      {/* Recent Matches/Differs Pattern */}
      <div className="bg-gray-750 rounded-lg p-4">
        <h4 className="text-lg font-medium text-white mb-3">
          Recent Pattern (Last 20)
        </h4>
        <div className="flex flex-wrap gap-2 justify-center">
          {matchesHistory.slice(-20).map((item, index) => (
            <div
              key={index}
              className={`w-12 h-12 rounded-lg flex flex-col items-center justify-center text-xs font-bold transition-all duration-300 ${
                item.matched
                  ? 'bg-green-500 text-white'
                  : 'bg-red-500 text-white'
              }`}
            >
              <div>{item.digit}</div>
              <div className="text-xs opacity-75">
                {item.matched ? 'M' : 'D'}
              </div>
            </div>
          ))}
        </div>
        {matchesHistory.length === 0 && (
          <div className="text-center text-gray-400 py-4">
            <p>Waiting for pattern data...</p>
          </div>
        )}
      </div>

      {/* Matches/Differs Statistics */}
      <div className="bg-gray-750 rounded-lg p-4">
        <h4 className="text-lg font-medium text-white mb-3">
          Pattern Analysis
        </h4>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-300">Match Rate:</span>
            <div className="flex items-center space-x-2">
              <div className="w-32 bg-gray-700 rounded-full h-2">
                <div 
                  className="h-2 bg-green-400 rounded-full transition-all duration-500"
                  style={{ width: `${matchesStats.percentage}%` }}
                ></div>
              </div>
              <span className="text-green-400 font-mono text-sm">
                {matchesStats.percentage.toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-300">Differ Rate:</span>
            <div className="flex items-center space-x-2">
              <div className="w-32 bg-gray-700 rounded-full h-2">
                <div 
                  className="h-2 bg-red-400 rounded-full transition-all duration-500"
                  style={{ width: `${differsStats.percentage}%` }}
                ></div>
              </div>
              <span className="text-red-400 font-mono text-sm">
                {differsStats.percentage.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderOddEvenTab = () => (
    <div className="space-y-6">
      {/* Odd/Even Overview */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-600/20 rounded-lg border border-blue-500 p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">
              {oddEvenStats.even}
            </div>
            <div className="text-sm text-blue-300 mb-1">Even Numbers</div>
            <div className="text-xs text-gray-400">
              {oddEvenStats.evenPercentage.toFixed(1)}% of {oddEvenStats.total} digits
            </div>
            <div className="text-xs text-blue-200 mt-2">
              0, 2, 4, 6, 8
            </div>
          </div>
        </div>
        <div className="bg-red-600/20 rounded-lg border border-red-500 p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-400">
              {oddEvenStats.odd}
            </div>
            <div className="text-sm text-red-300 mb-1">Odd Numbers</div>
            <div className="text-xs text-gray-400">
              {oddEvenStats.oddPercentage.toFixed(1)}% of {oddEvenStats.total} digits
            </div>
            <div className="text-xs text-red-200 mt-2">
              1, 3, 5, 7, 9
            </div>
          </div>
        </div>
      </div>

      {/* Recent Odd/Even Pattern */}
      <div className="bg-gray-750 rounded-lg p-4">
        <h4 className="text-lg font-medium text-white mb-3">
          Recent Pattern (Last 30)
        </h4>
        <div className="flex flex-wrap gap-2 justify-center">
          {recentDigits.slice(-30).map((digit, index) => {
            const isEven = digit % 2 === 0;
            const isRecent = index >= recentDigits.length - 5;
            return (
              <div
                key={index}
                className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                  isRecent
                    ? isEven
                      ? 'bg-blue-500 text-white shadow-lg scale-110 ring-2 ring-blue-300'
                      : 'bg-red-500 text-white shadow-lg scale-110 ring-2 ring-red-300'
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
            <p>Waiting for digit data...</p>
          </div>
        )}
      </div>

      {/* Detailed Odd/Even Analysis */}
      <div className="bg-gray-750 rounded-lg p-4">
        <h4 className="text-lg font-medium text-white mb-3">
          Detailed Analysis
        </h4>
        
        {/* Individual Digit Breakdown */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <h5 className="text-md font-medium text-blue-400 mb-2">Even Digits</h5>
            <div className="space-y-2">
              {[0, 2, 4, 6, 8].map(digit => {
                const count = digitHistory.filter(d => d === digit).length;
                const percentage = digitHistory.length > 0 ? (count / digitHistory.length) * 100 : 0;
                return (
                  <div key={digit} className="flex items-center justify-between">
                    <span className="text-gray-300">{digit}:</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-16 bg-gray-700 rounded-full h-2">
                        <div 
                          className="h-2 bg-blue-400 rounded-full transition-all duration-500"
                          style={{ width: `${percentage * 2}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-400 w-8">{count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <h5 className="text-md font-medium text-red-400 mb-2">Odd Digits</h5>
            <div className="space-y-2">
              {[1, 3, 5, 7, 9].map(digit => {
                const count = digitHistory.filter(d => d === digit).length;
                const percentage = digitHistory.length > 0 ? (count / digitHistory.length) * 100 : 0;
                return (
                  <div key={digit} className="flex items-center justify-between">
                    <span className="text-gray-300">{digit}:</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-16 bg-gray-700 rounded-full h-2">
                        <div 
                          className="h-2 bg-red-400 rounded-full transition-all duration-500"
                          style={{ width: `${percentage * 2}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-400 w-8">{count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Overall Statistics */}
        <div className="pt-4 border-t border-gray-600">
          <div className="flex justify-between items-center">
            <span className="text-gray-300">Even vs Odd Distribution:</span>
            <div className="flex items-center space-x-2">
              <div className="w-32 bg-gray-700 rounded-full h-3 flex overflow-hidden">
                <div 
                  className="bg-blue-400 transition-all duration-500"
                  style={{ width: `${oddEvenStats.evenPercentage}%` }}
                ></div>
                <div 
                  className="bg-red-400 transition-all duration-500"
                  style={{ width: `${oddEvenStats.oddPercentage}%` }}
                ></div>
              </div>
              <span className="text-xs text-gray-400">
                {oddEvenStats.evenPercentage.toFixed(1)}% / {oddEvenStats.oddPercentage.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-white">Live Ticks Analysis</h3>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <ConnectionIcon className={`h-4 w-4 ${connectionDisplay.color}`} />
            <span className={`text-sm ${connectionDisplay.color}`}>
              {connectionDisplay.text}
            </span>
          </div>
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
          {/* Analysis Tabs */}
          <div className="mb-6">
            <div className="flex space-x-1 bg-gray-700 rounded-lg p-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center space-x-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      activeTab === tab.id
                        ? 'bg-gray-900 text-white border border-gray-500'
                        : 'text-gray-300 hover:text-white hover:bg-gray-600'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                );
              })}
            </div>
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

          {/* Tab Content */}
          {renderTabContent()}
        </>
      )}
    </div>
  );
};

export default LiveTicks;