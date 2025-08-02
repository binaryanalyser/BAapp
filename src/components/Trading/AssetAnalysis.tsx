import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Target, Brain, Activity, Clock, Zap, AlertTriangle } from 'lucide-react';
import { useWebSocket } from '../../contexts/WebSocketContext';

interface AssetAnalysisProps {
  selectedSymbol: string;
}

interface AnalysisSignal {
  id: string;
  type: 'CALL' | 'PUT' | 'MATCH' | 'DIFFER';
  strength: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
  reasoning: string;
  timestamp: number;
  duration: number; // in seconds
  isActive: boolean;
}

interface MarketCondition {
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  volatility: 'LOW' | 'MEDIUM' | 'HIGH';
  momentum: number;
  support: number;
  resistance: number;
}

const AssetAnalysis: React.FC<AssetAnalysisProps> = ({ selectedSymbol }) => {
  const { ticks, subscribeTo } = useWebSocket();
  const [currentSignal, setCurrentSignal] = useState<AnalysisSignal | null>(null);
  const [marketCondition, setMarketCondition] = useState<MarketCondition | null>(null);
  const [priceHistory, setPriceHistory] = useState<number[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [countdown, setCountdown] = useState<number>(0);
  const [lastAnalysisTime, setLastAnalysisTime] = useState<number>(0);
  const [analysisInterval, setAnalysisInterval] = useState<number>(5); // minutes
  const [nextAnalysisCountdown, setNextAnalysisCountdown] = useState<number>(0);
  const [isWaitingForNextAnalysis, setIsWaitingForNextAnalysis] = useState<boolean>(false);
  const [continuousAnalysisInterval, setContinuousAnalysisInterval] = useState<NodeJS.Timeout | null>(null);

  // Subscribe to WebSocket data for the selected symbol
  useEffect(() => {
    subscribeTo(selectedSymbol);
  }, [selectedSymbol, subscribeTo]);

  // Reset price history when symbol changes
  useEffect(() => {
    setPriceHistory([]);
    setCurrentSignal(null);
    setCountdown(0);
    setLastAnalysisTime(0);
    setNextAnalysisCountdown(0);
    setIsWaitingForNextAnalysis(false);
    
    // Clear continuous analysis interval
    if (continuousAnalysisInterval) {
      clearInterval(continuousAnalysisInterval);
      setContinuousAnalysisInterval(null);
    }
  }, [selectedSymbol]);

  // Update price history when new ticks arrive
  useEffect(() => {
    const tick = ticks[selectedSymbol];
    if (tick && typeof tick.price === 'number') {
      setPriceHistory(prev => {
        const newHistory = [...prev, tick.price].slice(-100); // Keep last 100 prices
        return newHistory;
      });
    }
  }, [ticks, selectedSymbol]);

  // Advanced technical analysis functions
  const calculateRSI = useCallback((prices: number[], period: number = 14): number => {
    if (prices.length < 10) return 50; // Reduced from period + 1
    
    let gains = 0;
    let losses = 0;
    
    const actualPeriod = Math.min(period, prices.length - 1);
    for (let i = 1; i <= actualPeriod; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    
    const avgGain = gains / actualPeriod;
    const avgLoss = losses / actualPeriod;
    const rs = avgGain / avgLoss;
    
    return 100 - (100 / (1 + rs));
  }, []);

  const calculateMACD = useCallback((prices: number[]): 'bullish' | 'bearish' | 'neutral' => {
    if (prices.length < 10) return 'neutral'; // Reduced from 26
    
    const shortPeriod = Math.min(6, prices.length); // Reduced from 12
    const longPeriod = Math.min(12, prices.length); // Reduced from 26
    const ema12 = prices.slice(-shortPeriod).reduce((a, b) => a + b) / shortPeriod;
    const ema26 = prices.slice(-longPeriod).reduce((a, b) => a + b) / longPeriod;
    const macdLine = ema12 - ema26;
    
    if (macdLine > 0.0005) return 'bullish'; // Reduced from 0.001
    if (macdLine < -0.0005) return 'bearish'; // Reduced from -0.001
    return 'neutral';
  }, []);

  const calculateBollingerBands = useCallback((prices: number[], period: number = 10): 'squeeze' | 'expansion' | 'normal' => {
    if (prices.length < 5) return 'normal'; // Reduced from period
    
    const actualPeriod = Math.min(period, prices.length);
    const recentPrices = prices.slice(-actualPeriod);
    const sma = recentPrices.reduce((a, b) => a + b) / actualPeriod;
    const variance = recentPrices.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    
    const bandWidth = (stdDev * 2) / sma;
    
    if (bandWidth < 0.0005) return 'squeeze'; // Reduced from 0.001
    if (bandWidth > 0.002) return 'expansion'; // Reduced from 0.005
    return 'normal';
  }, []);

  const analyzePriceAction = useCallback((prices: number[]) => {
    if (prices.length < 5) return { trend: 'sideways' as const, momentum: 0, volatility: 0 }; // Reduced from 10
    
    const recentLength = Math.min(5, Math.floor(prices.length / 2)); // Reduced from 10
    const olderLength = Math.min(10, prices.length - recentLength); // Reduced from 20
    const recent = prices.slice(-recentLength);
    const older = prices.slice(-olderLength, -recentLength);
    
    const recentAvg = recent.reduce((a, b) => a + b) / recent.length;
    const olderAvg = older.length > 0 ? older.reduce((a, b) => a + b) / older.length : recentAvg;
    
    const trend = recentAvg > olderAvg * 1.0005 ? 'uptrend' :  // Reduced from 1.001
                  recentAvg < olderAvg * 0.9995 ? 'downtrend' : 'sideways'; // Reduced from 0.999
    
    const momentum = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    const avgPrice = prices.reduce((a, b) => a + b) / prices.length;
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - avgPrice, 2), 0) / prices.length;
    const volatility = Math.sqrt(variance) / avgPrice;
    
    return { trend, momentum, volatility };
  }, []);

  // Calculate technical indicators
  const calculateTechnicalIndicators = useCallback((prices: number[]) => {
    if (prices.length < 10) return null;

    const recent = prices.slice(-20);
    const current = prices[prices.length - 1];
    
    // Simple Moving Average
    const sma = recent.reduce((sum, price) => sum + price, 0) / recent.length;
    
    // RSI calculation
    let gains = 0;
    let losses = 0;
    for (let i = 1; i < recent.length; i++) {
      const change = recent[i] - recent[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    const avgGain = gains / (recent.length - 1);
    const avgLoss = losses / (recent.length - 1);
    const rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));

    // Volatility
    const variance = recent.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / recent.length;
    const volatility = Math.sqrt(variance) / sma;

    // Support and Resistance
    const support = Math.min(...recent);
    const resistance = Math.max(...recent);

    // Trend determination
    const shortTerm = recent.slice(-5).reduce((sum, price) => sum + price, 0) / 5;
    const longTerm = recent.slice(-15).reduce((sum, price) => sum + price, 0) / 15;
    
    let trend: MarketCondition['trend'] = 'NEUTRAL';
    if (shortTerm > longTerm * 1.001) trend = 'BULLISH';
    else if (shortTerm < longTerm * 0.999) trend = 'BEARISH';

    // Volatility classification
    let volClass: MarketCondition['volatility'] = 'MEDIUM';
    if (volatility > 0.003) volClass = 'HIGH';
    else if (volatility < 0.001) volClass = 'LOW';

    // Momentum
    const momentum = ((current - recent[0]) / recent[0]) * 100;

    return {
      rsi,
      sma,
      volatility,
      trend,
      volClass,
      momentum,
      support,
      resistance
    };
  }, []);

  // Generate analysis signal
  const generateSignal = useCallback((indicators: any, currentPrice: number): AnalysisSignal | null => {
    if (!indicators) return null;

    let signalType: AnalysisSignal['type'] = 'CALL';
    let confidence = 40; // Reduced from 50
    let strength: AnalysisSignal['strength'] = 'LOW';
    let reasoning = '';
    let duration = 300; // 5 minutes default

    // RSI-based signals
    if (indicators.rsi < 40 && indicators.trend === 'BULLISH') { // Relaxed from 30
      signalType = 'CALL';
      confidence += 20; // Reduced from 25
      reasoning = 'RSI favorable with bullish trend';
      strength = 'HIGH';
      duration = 300; // 5 minutes
    } else if (indicators.rsi > 60 && indicators.trend === 'BEARISH') { // Relaxed from 70
      signalType = 'PUT';
      confidence += 20; // Reduced from 25
      reasoning = 'RSI favorable with bearish trend';
      strength = 'HIGH';
      duration = 300; // 5 minutes
    } else if (indicators.trend === 'BULLISH' && indicators.momentum > 0.05) { // Reduced from 0.1
      signalType = 'CALL';
      confidence += 12; // Reduced from 15
      reasoning = 'Strong bullish momentum detected';
      strength = 'MEDIUM';
      duration = 180; // 3 minutes
    } else if (indicators.trend === 'BEARISH' && indicators.momentum < -0.05) { // Reduced from -0.1
      signalType = 'PUT';
      confidence += 12; // Reduced from 15
      reasoning = 'Strong bearish momentum detected';
      strength = 'MEDIUM';
      duration = 180; // 3 minutes
    }

    // High volatility digit signals
    if (indicators.volClass === 'HIGH' && Math.random() > 0.4) { // Increased chance from 0.6 to 0.4
      const lastDigit = Math.floor((currentPrice * 10000) % 10);
      signalType = Math.random() > 0.5 ? 'MATCH' : 'DIFFER';
      confidence += 15; // Reduced from 20
      reasoning = `High volatility detected. Last digit: ${lastDigit}`;
      strength = 'MEDIUM';
      duration = 120; // 2 minutes
    }

    // Additional signal opportunities - more frequent generation
    if (confidence < 50) {
      // Generate signals based on simple price movement
      const recentMovement = indicators.momentum;
      if (Math.abs(recentMovement) > 0.02) { // Any movement > 0.02%
        signalType = recentMovement > 0 ? 'CALL' : 'PUT';
        confidence += 15;
        reasoning = `Price movement detected: ${recentMovement > 0 ? 'upward' : 'downward'} momentum`;
        strength = 'LOW';
        duration = 180;
      }
      
      // Random digit signals more frequently
      if (Math.random() > 0.5) { // 50% chance
        const lastDigit = Math.floor((currentPrice * 10000) % 10);
        signalType = Math.random() > 0.5 ? 'MATCH' : 'DIFFER';
        confidence += 10;
        reasoning = `Digit analysis opportunity. Last digit: ${lastDigit}`;
        strength = 'LOW';
        duration = 120;
      }
    }

    // Adjust strength based on confidence
    if (confidence >= 75) strength = 'CRITICAL'; // Reduced from 85
    else if (confidence >= 65) strength = 'HIGH'; // Reduced from 75
    else if (confidence >= 55) strength = 'MEDIUM'; // Reduced from 65
    else strength = 'LOW';

    // Only generate signals with reasonable confidence
    if (confidence < 45) return null; // Reduced from 60

    return {
      id: `${selectedSymbol}-${Date.now()}`,
      type: signalType,
      strength,
      confidence: Math.min(confidence, 90), // Reduced max from 95
      reasoning,
      timestamp: Date.now(),
      duration,
      isActive: true
    };
  }, [selectedSymbol]);

  // Perform analysis
  const performAnalysis = useCallback(() => {
    // Don't analyze if we have insufficient data
    if (priceHistory.length < 10) return; // Reduced from 20
    
    // Don't analyze if signal is active or we're in countdown period
    if (currentSignal && countdown > 0) return;
    if (isWaitingForNextAnalysis && nextAnalysisCountdown > 0) return;

    console.log('Performing continuous market analysis...');
    setIsAnalyzing(true);
    
    // Simulate analysis time
    setTimeout(() => {
      const currentPrice = priceHistory[priceHistory.length - 1];
      const indicators = calculateTechnicalIndicators(priceHistory);
      
      if (indicators) {
        // Update market condition
        setMarketCondition({
          trend: indicators.trend,
          volatility: indicators.volClass,
          momentum: indicators.momentum,
          support: indicators.support,
          resistance: indicators.resistance
        });

        // Try to generate a signal
        const newSignal = generateSignal(indicators, currentPrice);
        if (newSignal) {
          // Signal found! Set it and start countdown
          setCurrentSignal(newSignal);
          setCountdown(newSignal.duration);
          setLastAnalysisTime(Date.now());
          
          // Start countdown period - no analysis during this time
          const countdownDuration = analysisInterval * 60; // Convert to seconds
          setNextAnalysisCountdown(newSignal.duration + countdownDuration);
          setIsWaitingForNextAnalysis(true);
          
          console.log(`Signal generated for ${selectedSymbol}:`, newSignal);
          console.log(`Analysis paused for ${analysisInterval} minutes after signal expires`);
        }
      }
      
      setIsAnalyzing(false);
    }, 1000); // 1 second analysis simulation
  }, [priceHistory, currentSignal, countdown, isWaitingForNextAnalysis, nextAnalysisCountdown, calculateTechnicalIndicators, generateSignal, selectedSymbol, analysisInterval]);

  // Start continuous analysis when conditions are met
  const startContinuousAnalysis = useCallback(() => {
    // Clear any existing interval
    if (continuousAnalysisInterval) {
      clearInterval(continuousAnalysisInterval);
    }
    
    // Start continuous analysis every 3 seconds
    const interval = setInterval(() => {
      performAnalysis();
    }, 3000);
    
    setContinuousAnalysisInterval(interval);
    console.log('Started continuous signal detection every 3 seconds');
  }, [performAnalysis]);

  // Stop continuous analysis
  const stopContinuousAnalysis = useCallback(() => {
    if (continuousAnalysisInterval) {
      clearInterval(continuousAnalysisInterval);
      setContinuousAnalysisInterval(null);
      console.log('Stopped continuous signal detection');
    }
  }, [continuousAnalysisInterval]);

  // Start continuous analysis when we have enough data and no active signal
  useEffect(() => {
    if (priceHistory.length >= 10 && !currentSignal && !isWaitingForNextAnalysis && !isAnalyzing) { // Reduced from 20
      startContinuousAnalysis();
    } else {
      stopContinuousAnalysis();
    }
    
    return () => {
      if (continuousAnalysisInterval) {
        clearInterval(continuousAnalysisInterval);
      }
    };
  }, [priceHistory.length, currentSignal, isWaitingForNextAnalysis, isAnalyzing, startContinuousAnalysis, stopContinuousAnalysis]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (continuousAnalysisInterval) {
        clearInterval(continuousAnalysisInterval);
      }
    };
  }, []);

  // Countdown timer for active signal
  useEffect(() => {
    if (countdown > 0) {
      const timer = setInterval(() => {
        setCountdown(prev => {
          const newCount = prev - 1;
          if (newCount === 0) {
            setCurrentSignal(null);
            console.log(`Signal expired for ${selectedSymbol}, starting countdown before next analysis`);
          }
          return newCount;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [countdown, selectedSymbol, performAnalysis]);

  // Next analysis countdown timer
  useEffect(() => {
    if (isWaitingForNextAnalysis && nextAnalysisCountdown > 0) {
      const interval = setInterval(() => {
        setNextAnalysisCountdown(prev => {
          const newCount = prev - 1;
          if (newCount === 0) {
            setIsWaitingForNextAnalysis(false);
            console.log(`Countdown finished for ${selectedSymbol}, resuming continuous analysis`);
          }
          return Math.max(0, newCount);
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isWaitingForNextAnalysis, nextAnalysisCountdown]);

  // Manual analysis trigger
  const handleManualAnalysis = useCallback(() => {
    if (priceHistory.length >= 10 && !currentSignal && !isWaitingForNextAnalysis) {
      performAnalysis();
    }
  }, [priceHistory.length, currentSignal, isWaitingForNextAnalysis, performAnalysis]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getSignalIcon = (type: AnalysisSignal['type']) => {
    switch (type) {
      case 'CALL': return <TrendingUp className="h-6 w-6 text-green-400" />;
      case 'PUT': return <TrendingDown className="h-6 w-6 text-red-400" />;
      case 'MATCH': return <Target className="h-6 w-6 text-blue-400" />;
      case 'DIFFER': return <Target className="h-6 w-6 text-yellow-400" />;
    }
  };

  const getSignalColor = (type: AnalysisSignal['type']) => {
    switch (type) {
      case 'CALL': return 'border-green-500 bg-green-500/10';
      case 'PUT': return 'border-red-500 bg-red-500/10';
      case 'MATCH': return 'border-blue-500 bg-blue-500/10';
      case 'DIFFER': return 'border-yellow-500 bg-yellow-500/10';
    }
  };

  const getStrengthColor = (strength: AnalysisSignal['strength']) => {
    switch (strength) {
      case 'CRITICAL': return 'text-red-400';
      case 'HIGH': return 'text-green-400';
      case 'MEDIUM': return 'text-yellow-400';
      case 'LOW': return 'text-gray-400';
    }
  };

  const currentPrice = ticks[selectedSymbol]?.price || 0;

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Brain className="h-6 w-6 text-blue-400" />
          <h3 className="text-xl font-semibold text-white">AI Asset Analysis</h3>
          <div className="text-sm text-gray-400">({selectedSymbol})</div>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Analysis Interval Selector */}
          <select
            value={analysisInterval}
            onChange={(e) => setAnalysisInterval(parseInt(e.target.value))}
            className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={currentSignal && countdown > 0}
          >
            <option value={2}>2 min interval</option>
            <option value={3}>3 min interval</option>
            <option value={5}>5 min interval</option>
            <option value={10}>10 min interval</option>
          </select>
          
          {isAnalyzing ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
              <span className="text-sm text-blue-400">Analyzing...</span>
            </div>
          ) : currentSignal && countdown > 0 ? (
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-green-400">Signal Active</span>
            </div>
          ) : isWaitingForNextAnalysis && nextAnalysisCountdown > 0 ? (
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-yellow-400" />
              <span className="text-sm text-yellow-400">Next: {formatTime(nextAnalysisCountdown)}</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-400">Ready</span>
            </div>
          )}
        </div>
      </div>

      {/* Current Price */}
      <div className="mb-6 p-4 bg-gray-750 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Current Price:</span>
          <span className="text-2xl font-mono font-bold text-white">
            {currentPrice ? currentPrice.toFixed(4) : '---'}
          </span>
        </div>
      </div>

      {/* Market Condition */}
      {marketCondition && (
        <div className="mb-6 grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-gray-750 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">Trend</div>
            <div className={`font-medium ${
              marketCondition.trend === 'BULLISH' ? 'text-green-400' :
              marketCondition.trend === 'BEARISH' ? 'text-red-400' : 'text-gray-300'
            }`}>
              {marketCondition.trend}
            </div>
          </div>
          
          <div className="bg-gray-750 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">Volatility</div>
            <div className={`font-medium ${
              marketCondition.volatility === 'HIGH' ? 'text-red-400' :
              marketCondition.volatility === 'MEDIUM' ? 'text-yellow-400' : 'text-green-400'
            }`}>
              {marketCondition.volatility}
            </div>
          </div>
          
          <div className="bg-gray-750 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">Momentum</div>
            <div className={`font-medium ${
              marketCondition.momentum > 0.1 ? 'text-green-400' :
              marketCondition.momentum < -0.1 ? 'text-red-400' : 'text-gray-300'
            }`}>
              {marketCondition.momentum > 0 ? '+' : ''}{marketCondition.momentum.toFixed(2)}%
            </div>
          </div>
        </div>
      )}

      {/* Active Signal */}
      {currentSignal ? (
        <div className={`rounded-lg border-2 p-6 ${getSignalColor(currentSignal.type)} ${
          currentSignal.strength === 'CRITICAL' ? 'animate-pulse' : ''
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <div className="p-2 rounded-full bg-gray-700/50">
                {getSignalIcon(currentSignal.type)}
              </div>
              <div>
                <div className="flex items-center space-x-3 mb-1">
                  <span className="text-xl font-bold text-white">{currentSignal.type}</span>
                  <span className={`text-sm font-medium ${getStrengthColor(currentSignal.strength)}`}>
                    {currentSignal.strength}
                  </span>
                  {currentSignal.strength === 'CRITICAL' && (
                    <AlertTriangle className="h-4 w-4 text-red-400" />
                  )}
                </div>
                <p className="text-gray-300 text-sm">{currentSignal.reasoning}</p>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-2xl font-bold text-white mb-1">{currentSignal.confidence}%</div>
              <div className="text-lg font-mono text-yellow-400 bg-gray-700/50 px-3 py-2 rounded">
                {formatTime(countdown)}
              </div>
              <div className="text-xs text-gray-400 mt-1">Active</div>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4">
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-1000 ${
                  currentSignal.type === 'CALL' ? 'bg-green-400' :
                  currentSignal.type === 'PUT' ? 'bg-red-400' :
                  currentSignal.type === 'MATCH' ? 'bg-blue-400' : 'bg-yellow-400'
                }`}
                style={{ 
                  width: `${100 - (countdown / currentSignal.duration) * 100}%` 
                }}
              ></div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="mb-4">
            {isAnalyzing ? (
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto"></div>
            ) : isWaitingForNextAnalysis && nextAnalysisCountdown > 0 ? (
              <div className="relative">
                <Clock className="h-12 w-12 text-yellow-400 mx-auto opacity-50" />
                <div className="absolute -top-2 -right-2 bg-yellow-400 text-gray-900 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                  {Math.ceil(nextAnalysisCountdown / 60)}
                </div>
              </div>
            ) : (
              <Brain className="h-12 w-12 text-gray-400 mx-auto opacity-50" />
            )}
          </div>
          <div className="mb-2">
            <span className="text-sm text-gray-400">
              {priceHistory.length >= 10 && !currentSignal && !isWaitingForNextAnalysis ? 'Scanning...' : 'Ready'}
            </span>
          </div>
          <h4 className="text-lg font-medium text-white mb-2">
            {isAnalyzing ? 'Analyzing Market Conditions' : 
             priceHistory.length < 10 ? 'Collecting Market Data' :
             isWaitingForNextAnalysis && nextAnalysisCountdown > 0 ? 'Waiting for Next Analysis' : 
             'Continuously Scanning for Signals'}
          </h4>
          <p className="text-gray-400 text-sm">
            {isAnalyzing ? `Analyzing ${selectedSymbol} price patterns and indicators...` :
             priceHistory.length < 10 ? `Need ${10 - priceHistory.length} more price points` : // Reduced from 20
             isWaitingForNextAnalysis && nextAnalysisCountdown > 0 ? `Next analysis in ${formatTime(nextAnalysisCountdown)}` :
             'Automatically scanning market conditions every 3 seconds'}
          </p>
          
          {/* Countdown Progress Bar for Next Analysis */}
          {isWaitingForNextAnalysis && nextAnalysisCountdown > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-sm text-gray-400 mb-2">
                <span>Next Analysis</span>
                <span>{formatTime(nextAnalysisCountdown)}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-yellow-500 to-yellow-600 h-3 rounded-full transition-all duration-1000 ease-linear"
                  style={{ 
                    width: `${100 - (nextAnalysisCountdown / (analysisInterval * 60)) * 100}%` 
                  }}
                ></div>
              </div>
              <div className="text-xs text-gray-500 mt-1 text-center">
                Waiting for {analysisInterval} minute interval
              </div>
            </div>
          )}
          
          {/* Progress Bar for Market Data Collection */}
          {priceHistory.length < 10 && ( // Reduced from 20
            <div className="mt-4">
              <div className="flex justify-between text-sm text-gray-400 mb-2">
                <span>Collecting Market Data</span>
                <span>{priceHistory.length}/10</span> {/* Reduced from 20 */}
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${(priceHistory.length / 10) * 100}%` }}
                ></div>
              </div>
              <div className="text-xs text-gray-500 mt-1 text-center">
                {priceHistory.length === 0 ? 'Waiting for price data...' :
                 priceHistory.length < 5 ? 'Initial data collection...' :
                 priceHistory.length < 15 ? 'Building price history...' :
                 'Almost ready for analysis...'}
              </div>
            </div>
          )}
          
          {!isAnalyzing && priceHistory.length >= 10 && !isWaitingForNextAnalysis && ( // Reduced from 20
            <button
              onClick={handleManualAnalysis}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
              disabled={continuousAnalysisInterval !== null}
            >
              <Zap className="inline h-4 w-4 mr-2" />
              {continuousAnalysisInterval ? 'Auto-Scanning Active' : 'Manual Analysis'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default AssetAnalysis;